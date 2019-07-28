/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const request = require('request');
const DbService = require('../db/dao');

const Provider = class {
    constructor(url) {
        this._url = url;
    }

    async run(instanceType, amount) {
        try {
            await this.createVpc();
            await this.describeZones();
            await this.createVSwitch();
            await this.createSecurityGroup();
            await this.authorizeSecurityGroup();
            let instances = await this.runInstances(instanceType, amount);
            return instances;
        } catch (err) {
            throw err;
        }
    }

    async runVpc() {
        try {
            await this.createVpc();
            await this.describeZones();
            await this.createVSwitch();
            await this.createSecurityGroup();
            await this.authorizeSecurityGroup();
        } catch (err) {
            throw err;
        }
    }

    async runWithPersistVpc(instanceType, amount) {
        try {
            let alicloud = await DbService.findOneAliCloud(this._consortiumId);
            this.setPersistVpc({
                RegionId: alicloud.region,
                VpcId: alicloud.vpc,
                ZoneId: alicloud.zone,
                SecurityGroupId: alicloud.security_group,
                VSwitchId: alicloud.vswitch,
            });
            let instances = await this.runInstances(instanceType, amount);
            return instances;
        } catch (err) {
            throw err;
        }
    }

    get(router) {
        return new Promise((resolve, reject) => {
            request({
                url: this._url.concat(router),
                method: 'GET'
            }, (err, res, body) => {
                if (!err && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else if (err) {
                    reject(err);
                } else {
                    reject(res.body);
                }
            });
        });
    }

    post(router, message) {
        return new Promise((resolve, reject) => {
            request({
                url: this._url.concat(router),
                method: 'POST',
                body: JSON.stringify(message),
                headers: [
                    {
                        name: 'content-type',
                        value: 'application/json'
                    }
                ]
            }, (err, res, body) => {
                if (!err && res.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else if (err) {
                    reject(err);
                } else {
                    reject(res.body);
                }
            });
        });
    }
};

module.exports = Provider;
