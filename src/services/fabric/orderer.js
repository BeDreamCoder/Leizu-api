/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';
const {HFCAIdentityType} = require('fabric-ca-client/lib/IdentityService');
const utils = require('../../libraries/utils');
const config = require('../../env');
const images = require('../../images');
const common = require('../../libraries/common');
const CredentialHelper = require('./tools/credential-helper');
const CryptoCaService = require('./tools/crypto-ca');
const DbService = require('../db/dao');
const Client = require('../transport/client');
const etcdctl = require('../coredns/etcdctl');

module.exports = class OrdererService {

    static async get() {
        return await DbService.findOrderes();
    }

    static async findById(id) {
        return await DbService.findOrdererById(id);
    }

    static async create(params) {
        const {organizationId, image, username, password, host, port} = params;

        const org = await DbService.findOrganizationById(organizationId);
        const consortium = await DbService.getConsortiumById(org.consortium_id);
        const ordererName = `${params.name}-${host.replace(/\./g, '-')}`;
        let ordererPort = params.ordererPort;
        if (!ordererPort) {
            ordererPort = common.PORT.ORDERER;
        }

        let cfgPath = process.env.RUN_MODE === common.RUN_MODE.LOCAL ? '/tmp/hyperledger/fabric' : common.FABRIC_CFG_PATH;
        let containerOptions = {
            image: images.fabric[consortium.version].orderer,
            cfgPath: `${cfgPath}/${consortium._id}/${org.name}/peers/${ordererName}`,
            workDir: `${common.FABRIC_WORKDIR}/orderer`,
            ordererName,
            domainName: org.domain_name,
            mspId: org.msp_id,
            port: ordererPort,
            enableTls: config.tlsEnabled,
            logLevel: config.fabricLogLevel
        };

        const connectionOptions = {
            host: host,
            username: username,
            password: password,
            port: port || config.ssh.port
        };

        const ordererDto = await this.preContainerStart(org, consortium, ordererName, containerOptions.cfgPath,
            connectionOptions, params.certs, params.genesisBlockPath);

        const client = Client.getInstance(connectionOptions);
        const parameters = utils.generateOrdererContainerOptions(containerOptions);
        await client.checkImage(containerOptions.image);
        const container = await client.createContainer(parameters);
        await utils.wait(`${common.PROTOCOL.TCP}:${host}:${ordererPort}`);
        if (container) {
            await etcdctl.createZone(`${ordererName}.${org.domain_name}`, host);

            return await DbService.addOrderer(Object.assign({}, ordererDto, {
                name: ordererName,
                organizationId: organizationId,
                location: `${host}:${ordererPort}`,
                consortiumId: consortium._id,
            }));
        } else {
            throw new Error('create orderer failed');
        }
    }

    static async preContainerStart(org, consortium, ordererName, cfgPath, connectionOptions, ordererDto, genesisBlockPath) {
        await this.createContainerNetwork(connectionOptions);

        const certFile = `${ordererDto.credentialsPath}.zip`;
        const remoteFile = `${cfgPath}.zip`;
        const remotePath = cfgPath;
        const client = Client.getInstance(connectionOptions);
        await client.transferFile({local: certFile, remote: remoteFile});
        await client.transferFile({local: genesisBlockPath, remote: `${remotePath}/genesis.block`});
        const bash = Client.getInstance(Object.assign({}, connectionOptions, {cmd: 'bash'}));
        await bash.exec(['-c', `unzip -o ${remoteFile} -d ${remotePath}`]);
        return ordererDto;
    }

    static async createContainerNetwork(connectionOptions) {
        const parameters = utils.generateContainerNetworkOptions({name: common.DEFAULT_NETWORK.NAME});
        await Client.getInstance(connectionOptions).createContainerNetwork(parameters);
    }

    static async prepareCerts(org, consortium, ordererName) {
        const ca = await DbService.findCertAuthorityByOrg(org._id);
        const ordererAdminUser = {
            enrollmentID: `${ordererName}.${org.domain_name}`,
            enrollmentSecret: `${ordererName}pw`,
        };
        const options = {
            caName: ca.name,
            orgName: org.name,
            url: ca.url,
            adminUser: ordererAdminUser
        };
        const caService = new CryptoCaService(options);
        await caService.bootstrapUserEnrollement();
        await caService.registerAdminUser(HFCAIdentityType.ORDERER);
        const mspInfo = await caService.enrollUser(ordererAdminUser);
        const tlsInfo = await caService.enrollUser(Object.assign({}, ordererAdminUser, {profile: 'tls'}));
        const ordererDto = {
            orgName: org.name,
            name: ordererName,
            consortiumId: String(consortium._id),
            tls: {}
        };
        ordererDto.adminKey = mspInfo.key.toBytes();
        ordererDto.adminCert = org.admin_cert;
        ordererDto.signcerts = mspInfo.certificate;
        ordererDto.rootCert = org.root_cert;
        ordererDto.tlsRootCert = org.root_cert;
        ordererDto.tls.cacert = org.root_cert;
        ordererDto.tls.key = tlsInfo.key.toBytes();
        ordererDto.tls.cert = tlsInfo.certificate;
        ordererDto.credentialsPath = await CredentialHelper.storePeerCredentials(ordererDto);
        return ordererDto;
    }
};
