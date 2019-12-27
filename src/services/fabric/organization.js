/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const fs = require('fs');
const common = require('../../libraries/common');
const utils = require('../../libraries/utils');
const images = require('../../images');
const stringUtil = require('../../libraries/string-util');
const CredentialHelper = require('./tools/credential-helper');
const DbService = require('../db/dao');
const Client = require('../transport/client');
const configtxlator = require('./tools/configtxlator');
const AliCloud = require('../provider/common').AliCloud;
const AliCloudClient = require('../provider/alicloud-client');
const config = require('../../env');
const etcdctl = require('../coredns/etcdctl');
const CaClient = require('./ca/client');
const {HFCAIdentityType} = require('fabric-ca-client/lib/IdentityService');

module.exports = class OrganizationService {

    static async create(payload) {
        const {name, type, consortiumId, host, port, username, password, enrollmentID, enrollmentSecret, userId} = payload;
        let consortium = await DbService.getConsortiumById(consortiumId);
        if (!consortium) {
            throw  new Error('The consortium not exist');
        }
        let organization = await DbService.findOrganizationByName(consortiumId, name);
        if (organization) {
            throw  new Error('The organization name already exists.');
        }

        let domainName = [name, consortium.name.toLowerCase(), common.BASE_AFFILIATION].join(common.SEPARATOR_DOT);
        let caUrl;
        let caPort = common.PORT.CA;
        if (utils.isStandalone()) {
            caPort = utils.generateRandomHttpPort();
        }
        if (config.tlsEnabled === true) {
            caUrl = common.PROTOCOL.HTTPS + '://' + host + ':' + caPort;
        } else {
            caUrl = common.PROTOCOL.HTTP + '://' + host + ':' + caPort;
        }
        let orgDto = {
            orgName: name,
            domainName: domainName,
            mspId: stringUtil.getMspId(name),
            consortiumId: consortiumId,
            type: type ? type : common.PEER_TYPE_PEER,
            userId: userId,
            enrollmentID: enrollmentID || common.BOOTSTRAPUSER.enrollmentID,
            enrollmentSecret: enrollmentSecret || common.BOOTSTRAPUSER.enrollmentSecret,
            caName: `ca.${domainName}`,
            url: caUrl,
        };

        try {
            let cfgPath = utils.isStandalone() ? '/tmp/hyperledger/fabric-ca-server' : common.CA_CFG_PATH;
            const containerOptions = {
                consortiumId: consortiumId,
                image: images.fabric[consortium.version].ca,
                caName: orgDto.caName,
                port: caPort,
                tlsEnabled: config.tlsEnabled,
                cfgPath: `${cfgPath}/${consortiumId}/${name}`,
                enrollmentID: orgDto.enrollmentID,
                enrollmentSecret: orgDto.enrollmentSecret,
            };

            const connectOptions = {
                username: username,
                password: password,
                host: host,
                port: port || config.ssh.port
            };
            const parameters = utils.generateCAContainerOptions(containerOptions);

            let client = Client.getInstance(connectOptions);
            await client.checkImage(containerOptions.image);
            let container = await client.createContainer(parameters);
            if (container) {
                await utils.wait(`${common.PROTOCOL.TCP}:${host}:${caPort}`);
                // await utils.wait(`${options.url}/api/v1/cainfo`);

                let caClient = new CaClient({url: caUrl, caName: orgDto.caName});
                let caRoot = await caClient.enroll(orgDto.enrollmentID, orgDto.enrollmentSecret, '');
                await caClient.setRegistrar(orgDto.enrollmentID, orgDto.mspId, caRoot);
                await caClient.deleteDefaultAffiliation();
                await caClient.addAffiliation(common.BASE_AFFILIATION);
                await caClient.addAffiliation([common.BASE_AFFILIATION, consortium.name.toLowerCase()].join(common.SEPARATOR_DOT));
                await caClient.addAffiliation([common.BASE_AFFILIATION, consortium.name.toLowerCase(), name].join(common.SEPARATOR_DOT));
                await caClient.registerAffiliationMgr(`Admin@${domainName}`, orgDto.enrollmentSecret,
                    [common.BASE_AFFILIATION, consortium.name.toLowerCase(), name].join(common.SEPARATOR_DOT), []);
                let orgAdmin = await caClient.enroll(`Admin@${domainName}`, orgDto.enrollmentSecret, '');
                orgDto.adminKey = orgAdmin.key.toBytes();
                orgDto.adminCert = orgAdmin.certificate;
                orgDto.signcerts = orgAdmin.certificate;
                orgDto.rootCert = orgAdmin.rootCertificate;
                orgDto.tlsRootCert = orgAdmin.rootCertificate;
                orgDto.mspPath = await CredentialHelper.storeOrgCredentials(orgDto);

                let organization = await DbService.addOrganization(orgDto);
                await DbService.addCertAuthority({
                    enrollmentID: orgDto.enrollmentID,
                    enrollmentSecret: orgDto.enrollmentSecret,
                    role: HFCAIdentityType.CLIENT,
                    keystore: '',
                    signcerts: caRoot.rootCertificate,
                    orgId: organization._id,
                    consortiumId: consortiumId,
                    profile: 'ca',
                    isRoot: true,
                });
                await DbService.addCertAuthority({
                    enrollmentID: `Admin@${domainName}`,
                    enrollmentSecret: orgDto.enrollmentSecret,
                    role: HFCAIdentityType.CLIENT,
                    keystore: orgAdmin.key.toBytes(),
                    signcerts: orgAdmin.certificate,
                    orgId: organization._id,
                    consortiumId: consortiumId,
                    profile: 'ca',
                    isRoot: false,
                });
                // transfer certs file to configtxlator for update channel
                await configtxlator.upload(`./data/${orgDto.consortiumId}/${orgDto.orgName}/`, `${orgDto.mspPath}.zip`);
                fs.unlinkSync(`${orgDto.mspPath}.zip`);
                if (!utils.isStandalone()) {
                    await etcdctl.createZone(consortiumId, orgDto.domainName, host);
                }
                return organization;
            }
        } catch (err) {
            throw err;
        }
    }

    static async handleAlicloud(params) {
        try {
            let consortium = await DbService.getConsortiumById(params.consortiumId);
            if (!consortium) {
                throw  new Error('The consortium not exist: ' + params.consortiumId);
            }
            if (consortium.mode === params.mode) {
                if (params.mode !== common.RUNMODE_CLOUD) {
                    return params;
                }
                const {name, type, consortiumId, domainName, instanceType, port} = params;
                let iType = utils.getInstanceType(instanceType);

                let recordId;
                if (iType === AliCloud.InstanceTypeNormal) {
                    let normalInstances = await DbService.findInstances(consortiumId, AliCloud.InstanceTypeNormal);
                    if (consortium.normal_instance_limit - normalInstances.length <= 0) {
                        throw new Error('Normal instances quantity exceeds the limit:' + consortium.normal_instance_limit);
                    }
                    let ins = await DbService.addAliCloud({
                        instanceType: AliCloud.InstanceTypeNormal,
                        consortiumId: consortiumId,
                    });
                    recordId = ins._id;
                } else if (iType === AliCloud.InstanceTypeHigh) {
                    let highInstances = await DbService.findInstances(consortiumId, AliCloud.InstanceTypeHigh);
                    if (consortium.high_instance_limit - highInstances.length <= 0) {
                        throw new Error('High instances quantity exceeds the limit:' + consortium.high_instance_limit);
                    }
                    let ins = await DbService.addAliCloud({
                        instanceType: AliCloud.InstanceTypeHigh,
                        consortiumId: consortiumId,
                    });
                    recordId = ins._id;
                }

                let instances;
                let client = new AliCloudClient(consortiumId, AliCloud.RegionId);
                if (consortium.network === common.CLOUD_NETWORK_CLASSICS) {
                    instances = await client.runWithPersistVpc(iType, 1);
                } else if (consortium.network === common.CLOUD_NETWORK_VPC) {
                    instances = await client.run(iType, 1);
                }

                await DbService.delAlicloudRecord(recordId);

                if (instances && instances.length === 1) {
                    return {
                        name: name,
                        type: type,
                        consortiumId: consortiumId,
                        domainName: domainName,
                        host: instances[0]['PublicIpAddress'][0],
                        port: port,
                        username: AliCloud.InstanceSystemName,
                        password: AliCloud.InstancePassword,
                    };
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
};
