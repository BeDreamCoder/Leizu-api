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
const DbService = require('../db/dao');
const Client = require('../transport/client');
const etcdctl = require('../coredns/etcdctl');
const CAdvisorService = require('./cadvisor');
const CaClient = require('./ca/client');

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
        // const ordererName = `${params.name}-${host.replace(/\./g, '-')}`;
        const ordererName = params.name;
        const ordererHostName = `${ordererName}.${org.domain_name}`;
        let ordererPort = common.PORT.ORDERER;
        let metricsPort = common.PORT.ORDERER_METRICS;
        let cfgPath = common.FABRIC_CFG_PATH;
        if (utils.isStandalone()) {
            ordererPort = utils.generateRandomHttpPort();
            metricsPort = utils.generateRandomHttpPort();
            cfgPath = '/tmp/hyperledger/fabric';
        }

        let containerOptions = {
            consortiumId: org.consortium_id,
            image: images.fabric[consortium.version].orderer,
            cfgPath: `${cfgPath}/${consortium._id}/${org.name}/peers/${ordererName}`,
            workDir: `${common.FABRIC_WORKDIR}/orderer`,
            hostname: ordererHostName,
            mspId: org.msp_id,
            port: ordererPort,
            metricsPort: metricsPort,
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
            connectionOptions, params.certs, params.genesisBlockPath, params.tlsRootCas);
        containerOptions.tlsRootCas = ordererDto.cas;
        const client = Client.getInstance(connectionOptions);
        const parameters = utils.generateOrdererContainerOptions(containerOptions);
        await client.checkImage(containerOptions.image);
        const container = await client.createContainer(parameters);
        await utils.wait(`${common.PROTOCOL.TCP}:${host}:${ordererPort}`);
        if (container) {
            if (!utils.isStandalone()) {
                await etcdctl.createZone(org.consortium_id, ordererHostName, host);
                if (utils.metricsEnabled()) {
                    await CAdvisorService.registerFabricService({
                        host: host,
                        name: common.NODE_TYPE_ORDERER,
                        port: common.PORT.ORDERER_METRICS
                    });
                }
            }

            await DbService.addCertAuthority({
                enroll_id: ordererDto.enrollment.enrollmentID,
                enroll_secret: ordererDto.enrollment.enrollmentSecret,
                role: HFCAIdentityType.ORDERER,
                keystore: ordererDto.adminKey,
                signcerts: ordererDto.signcerts,
                orgId: organizationId,
                consortiumId: consortium._id,
                profile: 'ca',
                isRoot: false,
            });

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

    static async preContainerStart(org, consortium, ordererName, cfgPath, connectionOptions, ordererDto, genesisBlockPath, tlsRootCas) {
        await this.createContainerNetwork(connectionOptions);

        const certFile = `${ordererDto.credentialsPath}.zip`;
        const remoteFile = `${cfgPath}.zip`;
        const remotePath = cfgPath;
        const client = Client.getInstance(connectionOptions);
        await client.transferFile({local: certFile, remote: remoteFile});
        await client.transferFile({local: genesisBlockPath, remote: `${remotePath}/genesis.block`});
        let cas = [];
        for (let key in tlsRootCas) {
            let remoteFile = `${remotePath}/tlsrootcas/ca${key}.crt`;
            await client.transferFile({local: tlsRootCas[key], remote: remoteFile});
            cas.push(remoteFile);
        }
        ordererDto.cas = cas;
        const bash = Client.getInstance(Object.assign({}, connectionOptions, {cmd: 'bash'}));
        await bash.exec(['-c', `unzip -o ${remoteFile} -d ${remotePath}`]);
        return ordererDto;
    }

    static async createContainerNetwork(connectionOptions) {
        const parameters = utils.generateContainerNetworkOptions({name: common.DEFAULT_NETWORK.NAME});
        await Client.getInstance(connectionOptions).createContainerNetwork(parameters);
    }

    static async prepareCerts(org, consortium, ordererName) {
        const orgMgr = await DbService.findCertAuthority({
            org_id: org._id,
            role: HFCAIdentityType.CLIENT,
            is_root: false,
        });
        const adminUser = {
            enrollmentID: `${ordererName}.${org.domain_name}`,
            enrollmentSecret: `${ordererName}pw`,
        };
        let caClient = new CaClient({url: org.url, caName: org.caname});
        let mgr = await caClient.enroll(orgMgr.enrollment_id, orgMgr.enrollment_secret, '');
        await caClient.setRegistrar(orgMgr.enrollment_id, org.msp_id, mgr);
        await caClient.registerRole(adminUser.enrollmentID, adminUser.enrollmentSecret, HFCAIdentityType.ORDERER,
            org.domain_name.split(common.SEPARATOR_DOT).reverse().join(common.SEPARATOR_DOT),
            [{name: 'role', value: 'orderer:ecert'}]);
        let mspInfo = await caClient.enroll(adminUser.enrollmentID, adminUser.enrollmentSecret, '');
        let tlsInfo = await caClient.enroll(adminUser.enrollmentID, adminUser.enrollmentSecret, 'tls');
        const ordererDto = {
            orgName: org.name,
            name: ordererName,
            consortiumId: String(consortium._id),
            tls: {},
            enrollment: adminUser
        };
        ordererDto.adminKey = mspInfo.key.toBytes();
        ordererDto.adminCert = mgr.certificate;
        ordererDto.signcerts = mspInfo.certificate;
        ordererDto.rootCert = mspInfo.rootCertificate;
        ordererDto.tlsRootCert = tlsInfo.rootCertificate;
        ordererDto.tls.cacert = tlsInfo.rootCertificate;
        ordererDto.tls.key = tlsInfo.key.toBytes();
        ordererDto.tls.cert = tlsInfo.certificate;
        ordererDto.credentialsPath = await CredentialHelper.storePeerCredentials(ordererDto);
        return ordererDto;
    }
};
