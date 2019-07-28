/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Provider = require('./provider');
const DbService = require('../db/dao');
const AliCloud = require('./common').AliCloud;
var host = require('../../env').aliCloud;

const AlicloudClient = class extends Provider {
    constructor(consortiumId, regionId) {
        super(process.env.ALICLOUD_URI || host.url);
        this._consortiumId = consortiumId;
        this._regionId = regionId;
        this._vpcId = '';
        this._zoneId = '';
        this._vswitchId = '';
        this._securityGroupId = '';
    }

    async createVpc() {
        let message = {
            RegionId: this._regionId,
            VpcName: AliCloud.VpcName,
            CidrBlock: AliCloud.VpcCidrBlock
        };
        try {
            let vpcResponse = await this.post('/v1/alicloud/vpc', message);
            this._vpcId = vpcResponse['VpcId'];
        } catch (err) {
            throw err;
        }
    }

    async createVSwitch() {
        let message = {
            RegionId: this._regionId,
            CidrBlock: AliCloud.VSwitchCidrBlock,
            VpcId: this._vpcId,
            ZoneId: this._zoneId,
            VSwitchName: AliCloud.VSwitchName
        };
        try {
            let vswitchResponse = await this.post('/v1/alicloud/vswitch', message);
            this._vswitchId = vswitchResponse['VSwitchId'];
        } catch (err) {
            throw err;
        }
    }

    async createSecurityGroup() {
        let message = {
            RegionId: this._regionId,
            VpcId: this._vpcId,
            SecurityGroupName: AliCloud.SecurityGroupName
        };
        try {
            let securityGroupResponse = await this.post('/v1/alicloud/securitygroup', message);
            this._securityGroupId = securityGroupResponse['SecurityGroupId'];
        } catch (err) {
            throw err;
        }
    }

    async authorizeSecurityGroup() {
        try {
            let promises = AliCloud.SGRulePortRanges.map(
                portRange => {
                    let message = {
                        RegionId: this._regionId,
                        SecurityGroupId: this._securityGroupId,
                        IpProtocol: AliCloud.SGRuleIpProtocol,
                        PortRange: portRange
                    };
                    return this.post('/v1/alicloud/securitygroup/ingress-rule', message);
                }
            );
            await Promise.all(promises);
        } catch (err) {
            throw err;
        }
    }

    async runInstances(instanceType, amount) {
        let message = {
            RegionId: this._regionId,
            ZoneId: this._zoneId,
            // ImageId: AliCloud.SnapshotImageId,
            InstanceType: instanceType,
            SecurityGroupId: this._securityGroupId,
            VSwitchId: this._vswitchId,
            InstanceChargeType: process.env.INSTANCE_CHARGE ? process.env.INSTANCE_CHARGE : AliCloud.InstanceChargeTypePostPaid,
            Amount: amount,
            HostName: AliCloud.InstanceHostName,
            Password: AliCloud.InstancePassword,
            TagKey: 'ConsortiumId',
            TagValue: this._consortiumId,
        };
        try {
            let runInstancesResponse = await this.post('/v1/alicloud/instances', message);
            if (runInstancesResponse && runInstancesResponse.length > 0) {
                for (let item of runInstancesResponse) {
                    await DbService.addAliCloud({
                        instance: item['InstanceId'],
                        instanceType: item['InstanceType'],
                        vpc: this._vpcId,
                        region: this._regionId,
                        zone: this._zoneId,
                        vswitch: this._vswitchId,
                        securityGroup: this._securityGroupId,
                        publicIpAddress: item['PublicIpAddress'][0],
                        consortiumId: this._consortiumId,
                        creationTime: new Date(item['CreationTime']),
                    });
                }
                return runInstancesResponse;
            } else {
                throw new Error('RunInstances Response is nil');
            }
        } catch (err) {
            throw err;
        }
    }

    async stopInstances(instanceId) {
        try {
            await this.get(`/v1/alicloud/instance/stop/${instanceId}`);
        } catch (err) {
            throw err;
        }
    }

    async deleteInstances(instanceId) {
        try {
            await this.get(`/v1/alicloud/instance/delete/${instanceId}`);
        } catch (err) {
            throw err;
        }
    }

    async describeRegions() {
        try {
            let regionsResponse = await this.get('/v1/alicloud/regions');
            return regionsResponse;
        } catch (err) {
            throw err;
        }
    }

    async describeZones() {
        try {
            let regionsResponse = await this.get(`/v1/alicloud/zones?regionId=${this._regionId}`);
            if (Array.isArray(regionsResponse) && regionsResponse.length > 0) {
                this._zoneId = regionsResponse[0]['ZoneId'];
            } else {
                throw new Error('Cant find available zoneId for region:' + this._regionId);
            }
        } catch (err) {
            throw err;
        }
    }

    setPersistVpc(data) {
        this._regionId = data.RegionId;
        this._vpcId = data.VpcId;
        this._zoneId = data.ZoneId;
        this._securityGroupId = data.SecurityGroupId;
        this._vswitchId = data.VSwitchId;
    }
};

module.exports = AlicloudClient;
