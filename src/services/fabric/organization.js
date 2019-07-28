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
const CryptoCaService = require('./tools/crypto-ca');
const DbService = require('../db/dao');
const Client = require('../transport/client');
const configtxlator = require('./tools/configtxlator');
const AliCloud = require('../provider/common').AliCloud;
const AliCloudClient = require('../provider/alicloud-client');
const config = require('../../env');
const etcdctl = require('../coredns/etcdctl');

module.exports = class OrganizationService {

    static async create(payload) {
        const {name, type, consortiumId, domainName, host, port, username, password} = payload;
        let consortium = await DbService.getConsortiumById(consortiumId);
        if (!consortium) {
            throw  new Error('The consortium not exist');
        }
        let organization = await DbService.findOrganizationByName(consortiumId, name);
        if (organization) {
            throw  new Error('The organization name already exists.');
        }

        let orgDto = {
            orgName: name,
            domainName: domainName,
            mspId: stringUtil.getMspId(name),
            consortiumId: consortiumId,
            type: type ? type : common.PEER_TYPE_PEER
        };
        let caPort = common.PORT.CA;
        if (utils.isSingleMachineTest()) {
            caPort = utils.generateRandomHttpPort();
        }
        try {
            let cfgPath = process.env.RUN_MODE === common.RUN_MODE.LOCAL ? '/tmp/hyperledger/fabric-ca-server' : common.CA_CFG_PATH;
            const containerOptions = {
                image: images.fabric[consortium.version].ca,
                name: name,
                domainName: domainName,
                port: caPort,
                enableTls: config.tlsEnabled,
                cfgPath: `${cfgPath}/${consortiumId}/${name}`,
            };

            const connectOptions = {
                username: username,
                password: password,
                host: host,
                port: port
            };
            const parameters = utils.generateCAContainerOptions(containerOptions);

            let client = Client.getInstance(connectOptions);
            await client.checkImage(containerOptions.image);
            let container = await client.createContainer(parameters);
            if (container) {
                let options = {
                    caName: stringUtil.getCaName(name),
                    orgName: name,
                    url: stringUtil.getUrl(common.PROTOCOL.HTTP, host, caPort)
                };
                await utils.wait(`${options.url}/api/v1/cainfo`);
                let cryptoCaService = new CryptoCaService(options);
                let result = await cryptoCaService.postContainerStart();
                if (result) {
                    orgDto.adminKey = result.enrollment.key.toBytes();
                    orgDto.adminCert = result.enrollment.certificate;
                    orgDto.signcerts = result.enrollment.certificate;
                    orgDto.rootCert = result.enrollment.rootCertificate;
                    orgDto.tlsRootCert = result.enrollment.rootCertificate;
                    orgDto.mspPath = await CredentialHelper.storeOrgCredentials(orgDto);
                }
                let organization = await DbService.addOrganization(orgDto);
                if (organization) {
                    await DbService.addCertAuthority({
                        name: options.caName,
                        url: options.url,
                        orgId: organization._id,
                        consortiumId: consortiumId
                    });
                    // transfer certs file to configtxlator for update channel
                    await configtxlator.upload(`./data/${orgDto.consortiumId}/${orgDto.orgName}/`, `${orgDto.mspPath}.zip`);
                    fs.unlinkSync(`${orgDto.mspPath}.zip`);

                    await etcdctl.createZone(orgDto.domainName, host);
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
