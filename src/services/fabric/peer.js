/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const {HFCAIdentityType} = require('fabric-ca-client/lib/IdentityService');
const ChannelService = require('./channel/channel');
const CredentialHelper = require('./tools/credential-helper');
const CryptoCaService = require('./tools/crypto-ca');
const DbService = require('../db/dao');
const FabricService = require('../db/fabric');
const PromClient = require('../prometheus/client');
const Client = require('../transport/client');
const common = require('../../libraries/common');
const utils = require('../../libraries/utils');
const config = require('../../env');
const images = require('../../images');
const AliCloud = require('../provider/common').AliCloud;
const AliCloudClient = require('../provider/alicloud-client');
const etcdctl = require('../coredns/etcdctl');
const CAdvisorService = require('./cadvisor');

module.exports = class PeerService {

    static async findByIdAndConsortiumId(id, consortiumId) {
        return await DbService.findPeerByFilter({_id: id, consortium_id: consortiumId});
    }

    static async list(orgId, consortiumId) {
        const {peers, channels, organizations} = await this.queryDetails(orgId, consortiumId);
        const promClient = new PromClient();
        const cpuMetrics = await promClient.queryCpuUsage();
        const memoryMetrics = await promClient.queryMemoryUsage();

        return peers.map((peer) => {
            let org = organizations;
            if (!orgId) {
                org = organizations.find(org => org._id.equals(peer.org_id));
            }
            let organizationName = (org && org.name) || null;
            let channelNames = channels.filter(channel => channel.peers.some(id => peer._id.equals(id))).map(channel => channel.name);
            let cpuMetric = cpuMetrics.find(data => data.metric.name.includes(peer.name));
            let cpu = 0;
            if (cpuMetric) {
                cpu = cpuMetric.value[1];
            }
            let memoryMetric = memoryMetrics.find(data => data.metric.name.includes(peer.name));
            let memory = 0;
            if (memoryMetric) {
                memory = memoryMetric.value[1];
            }
            //TODO: need to detect docker container status
            let status = 'running';
            if (memory === 0 && cpu === 0) {
                status = 'stop';
            }
            peer.name = utils.replacePeerName(peer.name);
            return {...peer.toJSON(), organizationName, channelNames, status, cpu, memory};
        });
    }

    static async queryDetails(orgId, consortiumId) {
        let peers, channels, organizations = [];
        if (orgId) {
            peers = await DbService.findPeersByOrgId(orgId);
            organizations = await DbService.findOrganizationById(orgId);
        } else {
            peers = await DbService.findPeersByConsortiumId(consortiumId);
            organizations = await DbService.getOrganizationsByFilter({consortium_id: consortiumId});

        }
        channels = await DbService.getChannels();
        return {peers, channels, organizations};
    }

    static async checkStatus(params) {
        const {host, username, password, port} = params;
        let connectionOptions = {
            host: host,
            username: username,
            password: password,
            port: port || config.ssh.port,
            cmd: 'bash'
        };
        const bash = Client.getInstance(connectionOptions);
        await bash.exec(['-c', 'date']);
    }

    static async create(params) {
        const {organizationId, name, username, password, host, port} = params;
        const org = await DbService.findOrganizationById(organizationId);
        if (!org) {
            throw new Error('The organization does not exist: ' + organizationId);
        }
        const consortium = await DbService.getConsortiumById(org.consortium_id);
        if (org.type !== common.PEER_TYPE_PEER) {
            throw new Error('The organization type can not orderer');
        }
        let peerNamePrefix = name ? name : 'peer';
        const peerName = `${peerNamePrefix}-${host.replace(/\./g, '-')}`;
        let peerPort = common.PORT.PEER;
        if (utils.isSingleMachineTest()) {
            peerPort = utils.generateRandomHttpPort();
        }
        let cfgPath = process.env.RUN_MODE === common.RUN_MODE.LOCAL ? '/tmp/hyperledger/fabric' : common.FABRIC_CFG_PATH;
        let containerOptions = {
            image: images.fabric[consortium.version].peer,
            cfgPath: `${cfgPath}/${org.consortium_id}/${org.name}/peers/${peerName}`,
            workDir: `${common.FABRIC_WORKDIR}/peer`,
            peerName,
            domainName: org.domain_name,
            mspId: org.msp_id,
            port: peerPort,
            enableTls: config.tlsEnabled,
            logLevel: config.fabricLogLevel
        };

        let connectionOptions = {
            host: host,
            username: username,
            password: password,
            port: port || config.ssh.port
        };

        const peerDto = await this.preContainerStart(org, peerName, containerOptions.cfgPath, connectionOptions);

        const client = Client.getInstance(connectionOptions);
        const parameters = utils.generatePeerContainerOptions(containerOptions);
        await client.checkImage(containerOptions.image);
        const container = await client.createContainer(parameters);
        await utils.wait(`${common.PROTOCOL.TCP}:${host}:${peerPort}`);
        if (container) {
            await etcdctl.createZone(`${peerName}.${org.domain_name}`, host);

            await CAdvisorService.registerFabricService({
                host: host,
                name: common.NODE_TYPE_PEER,
                port: common.PORT.PEER_METRICS
            });

            return await DbService.addPeer(Object.assign({}, peerDto, {
                name: peerName,
                organizationId: organizationId,
                location: `${host}:${peerPort}`,
                consortiumId: org.consortium_id,
            }));
        } else {
            throw new Error('create peer failed');
        }
    }

    static async preContainerStart(org, peerName, cfgPath, connectionOptions) {
        await this.createContainerNetwork(connectionOptions);

        const peerDto = await this.prepareCerts(org, peerName);
        const certFile = `${peerDto.credentialsPath}.zip`;
        const remoteFile = `${cfgPath}.zip`;
        const remotePath = cfgPath;
        await Client.getInstance(connectionOptions).transferFile({
            local: certFile,
            remote: remoteFile
        });
        const bash = Client.getInstance(Object.assign({}, connectionOptions, {cmd: 'bash'}));
        await bash.exec(['-c', `unzip -o ${remoteFile} -d ${remotePath}`]);
        return peerDto;
    }

    static async createContainerNetwork(connectionOptions) {
        const parameters = utils.generateContainerNetworkOptions({name: common.DEFAULT_NETWORK.NAME});
        await Client.getInstance(connectionOptions).createContainerNetwork(parameters);
    }

    static async prepareCerts(org, peerName) {
        const ca = await DbService.findCertAuthorityByOrg(org._id);
        const peerAdminUser = {
            enrollmentID: `${peerName}.${org.domain_name}`,
            enrollmentSecret: `${peerName}pw`,
        };
        const options = {
            caName: ca.name,
            orgName: org.name,
            url: ca.url,
            adminUser: peerAdminUser
        };
        const caService = new CryptoCaService(options);
        await caService.bootstrapUserEnrollement();
        await caService.registerAdminUser(HFCAIdentityType.PEER);
        const mspInfo = await caService.enrollUser(peerAdminUser);
        const tlsInfo = await caService.enrollUser(Object.assign({}, peerAdminUser, {profile: 'tls'}));
        const peerDto = {
            orgName: org.name,
            name: peerName,
            consortiumId: org.consortium_id.toString(),
            tls: {}
        };
        peerDto.adminKey = mspInfo.key.toBytes();
        peerDto.adminCert = org.admin_cert;
        peerDto.signcerts = mspInfo.certificate;
        peerDto.rootCert = org.root_cert;
        peerDto.tlsRootCert = org.root_cert;
        peerDto.tls.cacert = org.root_cert;
        peerDto.tls.key = tlsInfo.key.toBytes();
        peerDto.tls.cert = tlsInfo.certificate;
        peerDto.credentialsPath = await CredentialHelper.storePeerCredentials(peerDto);
        return peerDto;
    }

    static async checkChannel(organizationId, peers, channelId) {
        try {
            if (!channelId) return;
            const org = await DbService.findOrganizationById(organizationId);
            if (!org) {
                throw new Error('The organization does not exist: ' + organizationId);
            }
            if (org.type !== common.PEER_TYPE_PEER) {
                throw new Error('The organization type can not orderer');
            }
            const channel = await DbService.getChannelById(channelId);
            if (!channel) {
                throw new Error('The channel does not exist: ' + channelId);
            }
            let channelService = await ChannelService.getInstance(organizationId, channel.name);
            if (channel.orgs.indexOf(organizationId) === -1) {
                await channelService.updateAppChannel(channelId);
                await channelService.joinChannel(peers);
                await FabricService.findChannelAndUpdate(channelId, {orgs: [organizationId], peers: peers});
            } else {
                await channelService.joinChannel(peers);
                await FabricService.findChannelAndUpdate(channelId, {peers: peers});
            }
        } catch (err) {
            throw err;
        }
    }

    static async handleAlicloud(mode, organizationId, peers) {
        try {
            const org = await DbService.findOrganizationById(organizationId);
            if (!org) {
                throw new Error('The organization does not exist: ' + organizationId);
            }
            let consortiumId = org.consortium_id;
            let consortium = await DbService.getConsortiumById(consortiumId);
            if (!consortium) {
                throw  new Error('The consortium not exist: ' + org.consortium_id);
            }
            if (consortium.mode === mode) {
                if (mode !== common.RUNMODE_CLOUD) {
                    return peers;
                }
                let instancesAmount = PeerService.countEcsInstances(peers);

                /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
                if (instancesAmount.normal > 0) {
                    let normalInstances = await DbService.findInstances(consortiumId, AliCloud.InstanceTypeNormal);
                    if (instancesAmount.normal > consortium.normal_instance_limit - normalInstances.length) {
                        throw new Error('Normal instances quantity exceeds the limit:' + consortium.normal_instance_limit);
                    }
                }
                if (instancesAmount.high > 0) {
                    let highInstances = await DbService.findInstances(consortiumId, AliCloud.InstanceTypeHigh);
                    if (instancesAmount.high > consortium.high_instance_limit - highInstances.length) {
                        throw new Error('High instances quantity exceeds the limit:' + consortium.high_instance_limit);
                    }
                }
                let instanceIds = [];
                for (let i = 0; i < instancesAmount.normal; i++) {
                    let ins = await DbService.addAliCloud({
                        instanceType: AliCloud.InstanceTypeNormal,
                        consortiumId: consortiumId,
                    });
                    instanceIds.push(ins._id);
                }
                for (let i = 0; i < instancesAmount.high; i++) {
                    let ins = await DbService.addAliCloud({
                        instanceType: AliCloud.InstanceTypeHigh,
                        consortiumId: consortiumId,
                    });
                    instanceIds.push(ins._id);
                }
                /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

                let promises = [];
                let client = new AliCloudClient(consortiumId, AliCloud.RegionId);
                if (consortium.network === common.CLOUD_NETWORK_CLASSICS) {
                    let alicloud = await DbService.findOneAliCloud(consortiumId);
                    client.setPersistVpc({
                        RegionId: alicloud.region,
                        VpcId: alicloud.vpc,
                        ZoneId: alicloud.zone,
                        SecurityGroupId: alicloud.security_group,
                        VSwitchId: alicloud.vswitch,
                    });
                    if (instancesAmount.normal > 0) {
                        promises.push(client.runInstances(AliCloud.InstanceTypeNormal, instancesAmount.normal));
                    }
                    if (instancesAmount.high > 0) {
                        promises.push(client.runInstances(AliCloud.InstanceTypeHigh, instancesAmount.high));
                    }
                } else {
                    for (let item of peers) {
                        promises.push(client.run(utils.getInstanceType(item.instanceType), 1));
                    }
                }
                let instances = await Promise.all(promises);

                instanceIds.forEach(id => DbService.delAlicloudRecord(id));

                if (instances && instances.length > 0) {
                    let index = {
                        normal: 0,
                        high: -1,
                    };
                    if (instancesAmount.normal > 0 && instancesAmount.high > 0) {
                        index.high = 1;
                    } else if (instancesAmount.high > 0) {
                        index.high = 0;
                    }
                    return peers.map(peer => {
                        if (peer.instanceType === common.CLOUD_INSTANCE_TYPE_NORMAL) {
                            if (instances[index.normal] && instances[index.normal].length > 0) {
                                let item = instances[index.normal].pop();
                                return {
                                    organizationId: organizationId,
                                    image: peer.image,
                                    name: peer.name,
                                    host: item['PublicIpAddress'][0],
                                    port: peer.port,
                                    username: AliCloud.InstanceSystemName,
                                    password: AliCloud.InstancePassword,
                                };
                            } else {
                                throw new Error('convertToSSHRequest occurred error: Normal instances not match request');
                            }
                        } else if (peer.instanceType === common.CLOUD_INSTANCE_TYPE_HIGH) {
                            if (instances[index.high] && instances[index.high].length > 0) {
                                let item = instances[index.high].pop();
                                return {
                                    organizationId: organizationId,
                                    image: peer.image,
                                    name: peer.name,
                                    host: item['PublicIpAddress'][0],
                                    port: peer.port,
                                    username: AliCloud.InstanceSystemName,
                                    password: AliCloud.InstancePassword,
                                };
                            } else {
                                throw new Error('convertToSSHRequest occurred error: High instances not match request');
                            }
                        }
                    });
                } else {
                    throw new Error('Create instances failed');
                }
            } else {
                throw new Error('Param mode is invalid');
            }
        } catch (err) {
            throw err;
        }
    }

    static countEcsInstances(peers) {
        let instances = {normal: 0, high: 0};
        let counter = (type) => {
            if (type === common.CLOUD_INSTANCE_TYPE_NORMAL) {
                instances.normal++;
            } else if (type === common.CLOUD_INSTANCE_TYPE_HIGH) {
                instances.high++;
            }
        };
        if (peers && peers.length > 0) {
            for (let v of peers) {
                counter(v.instanceType);
            }
        }
        return instances;
    }

};
