/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../../libraries/log4js');
logger.category = 'RequestHandler';
const common = require('../../libraries/common');
const utils = require('../../libraries/utils');
const Handler = require('./handler');
const RequestDaoService = require('../db/request');
const config = require('../../env');
const DbService = require('../db/dao');
const OrdererService = require('../fabric/orderer');
const CreateConfigTx = require('../fabric/tools/configtxgen');
const ConfigTxlator = require('../fabric/tools/configtxlator');
const ActionFactory = require('../action/factory');
const RequestHelper = require('./request-helper');
const AliCloud = require('../provider/common').AliCloud;
const AlicloudClient = require('../provider/alicloud-client');

module.exports = class RequestHandler extends Handler {

    constructor(ctx) {
        super(ctx);
        this.request = null;
        this.requestDaoService = null;
        this.organizations = {
            peerOrgs: [],
            ordererOrg: {}
        };
        this.peers = {};
        this.orderer = {};
    }

    async handlerRequest() {
        try {
            await this.persistRequest();
            await this.handleCloudMode();
            this.decomposeRequest();
            await this.provisionNetwork();
            await this.updateRequestStatus(common.REQUEST_STATUS_SUCCESS);
        } catch (error) {
            try {
                let rollBackAction = ActionFactory.getRequestRollbackAction({id: this.request._id});
                await rollBackAction.execute();
            } catch (err) {
                logger.error(err);
            }
            throw error;
        }
    }

    async postRequest() {
        try {
            let consortiumUpdateAction = ActionFactory.getConsortiumUpdateAction({requestId: this.request._id});
            await consortiumUpdateAction.execute();
        } catch (error) {
            logger.error(error);
        }
        this.response = this.request;
    }

    async persistRequest() {
        this.requestDaoService = new RequestDaoService();
        this.request = await this.requestDaoService.addRequest(this.ctx.request.body);
    }

    async handleCloudMode() {
        if (this.ctx.request.body.mode !== common.RUNMODE_CLOUD) return;
        try {
            let instancesAmount = RequestHelper.countEcsInstances(this.ctx.request.body);
            if (instancesAmount.normal > this.ctx.request.body.normalInstanceLimit) {
                throw new Error('Normal instances quantity exceeds the limit:' + this.ctx.request.body.normalInstanceLimit);
            }
            if (instancesAmount.high > this.ctx.request.body.highInstanceLimit) {
                throw new Error('High instances quantity exceeds the limit:' + this.ctx.request.body.highInstanceLimit);
            }
            let client = new AlicloudClient(this.request.consortiumId, AliCloud.RegionId);
            let promises = [];
            if (this.ctx.request.body.network === common.CLOUD_NETWORK_CLASSICS) {
                await client.runVpc();
                if (instancesAmount.normal > 0) {
                    promises.push(client.runInstances(AliCloud.InstanceTypeNormal, instancesAmount.normal));
                }
                if (instancesAmount.high > 0) {
                    promises.push(client.runInstances(AliCloud.InstanceTypeHigh, instancesAmount.high));
                }
            } else {
                if (instancesAmount.normal > 0) {
                    for (let i = 0; i < instancesAmount.normal; i++) {
                        promises.push(client.run(AliCloud.InstanceTypeNormal, 1));
                    }
                }
                if (instancesAmount.high > 0) {
                    for (let i = 0; i < instancesAmount.high; i++) {
                        promises.push(client.run(AliCloud.InstanceTypeHigh, 1));
                    }
                }
            }
            let instances = await Promise.all(promises);
            RequestHelper.convertToSSHRequest(this.ctx.request.body, instances, instancesAmount);
        } catch (err) {
            throw err;
        }
    }

    decomposeRequest() {
        this.parsedRequest = RequestHelper.decomposeRequest(this.ctx.request.body);
        this.parsedRequest.requestId = this.request._id;
        this.parsedRequest.consortiumId = this.request.consortiumId;
    }

    async updateRequestStatus(status) {
        this.request.status = status;
        let consortium = await this.requestDaoService.updateStatusById(this.request._id, status);
        this.request = Object.assign(this.request, consortium.toObject());
    }

    async provisionNetwork() {
        await this.provisionPeerOrganizations();
        await this.provisionPeers();
        await this.provisionOrdererOrganization();
        await this.provisionOrderers();
        if (process.env.RUN_MODE === common.RUN_MODE.REMOTE) {
            await this.provisionConsul();
        }
        await this.createNewChannel();
        await this.makePeersJoinChannel();
    }

    async provisionPeerOrganizations() {
        for (let peer of this.parsedRequest.peers) {
            peer.consortiumId = this.parsedRequest.consortiumId;
            let provisionAction = ActionFactory.getCAProvisionAction(peer);
            this.organizations.peerOrgs[peer.orgName] = await provisionAction.execute();
        }
    }

    async provisionOrdererOrganization() {
        let orderer = this.parsedRequest.orderer;
        orderer.consortiumId = this.parsedRequest.consortiumId;
        let provisionAction = ActionFactory.getCAProvisionAction(orderer);
        let ordererOrg = await provisionAction.execute();
        const org = await DbService.findOrganizationById(ordererOrg._id);
        const consortium = await DbService.getConsortiumById(org.consortium_id);
        let certs = await this._prepareOrderersCerts(org, consortium);
        let genesisBlockPath = await this._prepareGenesisBlock(org, consortium);
        ordererOrg.certs = certs;
        ordererOrg.genesisBlockPath = genesisBlockPath;
        this.organizations.ordererOrg[orderer.orgName] = ordererOrg;
    }

    async _prepareOrderersCerts(org, consortium) {
        let orderers = this.parsedRequest.orderer.nodes;
        if (!orderers || orderers.length === 0) {
            throw new Error('Cant found any orderer peers');
        }
        let orderersCerts = {};
        for (let item of orderers) {
            const ordererName = `${item.name}-${item.host.replace(/\./g, '-')}`;
            let ordererDto = await OrdererService.prepareCerts(org, consortium, ordererName);
            orderersCerts[item.name] = ordererDto;
            // orderer tls cert for ectdraft
            await ConfigTxlator.upload(`./data/${consortium._id}/${org.name}/peers/${ordererName}`, `${ordererDto.credentialsPath}.zip`);
        }
        return orderersCerts;
    }

    async _prepareGenesisBlock(org, consortium) {
        let configuration = JSON.parse(this.request.configuration);
        // Addresses
        let addresses = [];
        for (let node of configuration.ordererOrg.orderer) {
            let ordererName = `${node.name}-${node.ip.replace(/\./g, '-')}`;
            let ordererPort = common.PORT.ORDERER;
            if (utils.isSingleMachineTest()) {
                ordererPort = utils.generateRandomHttpPort();
            }
            if (config.tlsEnabled) {
                addresses.push(`${ordererName}.${org.domain_name}:${ordererPort}`);
            } else {
                addresses.push(`${node.ip}:${ordererPort}`);
            }
        }

        // Kafka
        let kafkaBrokers;
        if (configuration.consensus === common.CONSENSUS_KAFKA) {
            if (!configuration.kafka || configuration.kafka.length === 0) {
                throw new Error('kafka config not exists in options');
            }
            kafkaBrokers = configuration.kafka.map((item) => `${item.ip}:${common.PORT.KAFKA_BROKER}`);
        }

        // EtcdRaft
        let etcdRaft;
        if (configuration.consensus === common.CONSENSUS_RAFT) {
            let consenters = [];
            for (let node of configuration.ordererOrg.orderer) {
                let ordererName = `${node.name}-${node.ip.replace(/\./g, '-')}`;
                let ordererPort = common.PORT.ORDERER;
                if (utils.isSingleMachineTest()) {
                    ordererPort = utils.generateRandomHttpPort();
                }
                // if (config.tlsEnabled) {
                consenters.push({name: ordererName, host: `${ordererName}.${org.domain_name}`, port: ordererPort});
                // } else {
                //     consenters.push({name: ordererName, host: node.ip, port: ordererPort});
                // }
            }
            etcdRaft = {consenters};
        }

        // Organizations
        let organizations = [];
        for (let key in this.organizations.peerOrgs) {
            let item = this.organizations.peerOrgs[key];
            let peers = await DbService.findPeersByOrgId(item._id, common.PEER_TYPE_PEER);
            let anchorPeer = [];
            if (peers && peers.length > 0) {
                let item = peers[0];
                let flag = item.location.indexOf(common.SEPARATOR_COLON);
                let host = item.location.slice(0, flag);
                let port = item.location.slice(flag + common.SEPARATOR_COLON.length);
                anchorPeer.push({host: host, port: port});
            }
            organizations.push({
                Name: item.name,
                MspId: item.msp_id,
                Type: common.PEER_TYPE_PEER,
                AnchorPeers: anchorPeer
            });
        }
        organizations.push({
            Name: org.name,
            MspId: org.msp_id,
            Type: common.PEER_TYPE_ORDER
        });

        let options = {
            ConsortiumId: String(consortium._id),
            Consortium: consortium.name,
            Orderer: {
                OrdererType: configuration.consensus,
                OrderOrg: org.name,
                Addresses: addresses,
                Kafka: {
                    Brokers: kafkaBrokers
                },
                EtcdRaft: etcdRaft
            },
            Organizations: organizations
        };

        let configTxYaml = new CreateConfigTx(options).buildConfigtxYaml();
        let genesis = await ConfigTxlator.outputGenesisBlock(common.CONFIFTX_OUTPUT_GENESIS_BLOCK, common.SYSTEM_CHANNEL, configTxYaml, '', '');
        const genesisBlockPath = path.join(config.cryptoConfig.path, String(consortium._id), org.name, 'genesis.block');
        fs.writeFileSync(genesisBlockPath, genesis);

        return genesisBlockPath;
    }

    async provisionPeers() {
        for (let item of this.parsedRequest.peers) {
            for (let node of item.nodes) {
                let organization = this.organizations.peerOrgs[node.orgName];
                node.organizationId = organization._id;
                node.image = this.parsedRequest.peerImage;
                let provisionAction = ActionFactory.getPeerProvisionAction(node);
                this.peers[node.name] = await provisionAction.execute();
            }
        }
    }

    async provisionConsul() {
        let ipList = [];
        for (let item of this.parsedRequest.consuls) {
            if (ipList.indexOf(item.host) === -1) {
                let provisionAction = ActionFactory.getConsulCreateAction(item);
                await provisionAction.execute();
                ipList.push(item.host);
            }

        }
    }

    async provisionOrderers() {
        if (this.parsedRequest.isKafkaConsensus) {
            let kafkaAction = ActionFactory.getKafkaProvisionAction(Object.assign(this.parsedRequest.kafkaCluster,
                {version: this.parsedRequest.version}));
            await kafkaAction.execute();
        }

        let peerOrganizationIds = [];
        for (let property in this.organizations.peerOrgs) {
            let organization = this.organizations.peerOrgs[property];
            if (organization) {
                peerOrganizationIds.push(organization._id);
            }
        }

        var eventPromises = [];
        for (let node of this.parsedRequest.orderer.nodes) {
            let exePromise = new Promise((resolve, reject) => {
                try {
                    node.organizationId = this.organizations.ordererOrg[this.parsedRequest.orderer.orgName]._id;
                    node.peerOrganizationIds = peerOrganizationIds;
                    node.ordererType = this.parsedRequest.consensus;
                    node.image = this.parsedRequest.ordererImage;
                    node.certs = this.organizations.ordererOrg[this.parsedRequest.orderer.orgName].certs[node.name];
                    node.genesisBlockPath = this.organizations.ordererOrg[this.parsedRequest.orderer.orgName].genesisBlockPath;
                    let provisionAction = ActionFactory.getOrdererProvisionAction(node);
                    resolve(provisionAction.execute());
                } catch (e) {
                    reject(e.message);
                }
            });
            eventPromises.push(exePromise);
        }
        await Promise.all(eventPromises).then(async orderers => {
            orderers.map(node => this.orderer[node.name] = node);
        }, err => {
            throw err;
        });
    }

    async createNewChannel() {
        if (!this.parsedRequest.channel) {
            throw new Error('no channel definition');
        }
        let organizationIds = [];
        for (let property in this.organizations.peerOrgs) {
            let organization = this.organizations.peerOrgs[property];
            if (organization) {
                if (!this.parsedRequest.channel.orgs || this.parsedRequest.channel.orgs.length === 0) {
                    organizationIds.push(organization._id);
                } else if (this.parsedRequest.channel.orgs.indexOf(organization.name) !== -1) {
                    organizationIds.push(organization._id);
                }
            }
        }
        if (organizationIds.length === 0) {
            throw new Error('no channel orgs definition');
        }
        let parameters = {
            name: this.parsedRequest.channel.name,
            organizationIds: organizationIds
        };
        let createAction = ActionFactory.getChannelCreateAction(parameters);
        this.channel = await createAction.execute();
    }

    async makePeersJoinChannel() {
        let channelName = this.parsedRequest.channel.name;
        for (let property in this.organizations.peerOrgs) {
            let organization = this.organizations.peerOrgs[property];
            if (!organization) continue;
            if (this.parsedRequest.channel.orgs && this.parsedRequest.channel.orgs.length > 0
                && this.parsedRequest.channel.orgs.indexOf(organization.name) === -1) continue;
            let parameters = {};
            parameters.organization = organization;
            parameters.channelName = channelName;
            parameters.channelId = this.channel._id;
            let joinAction = ActionFactory.getPeerJoinAction(parameters);
            await joinAction.execute();
        }
    }

};

