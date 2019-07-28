/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Joi = require('joi');
const {objectId, string, hostname, ip, port} = require('./schema-utils');
const common = require('../../common');

const bareSchema = () => {
    if (process.env.RUN_MODE === common.RUN_MODE.REMOTE) {
        return {
            host: ip,
            username: string,
            password: string,
            port: port
        };
    }
    else {
        return {
            host: Joi.string().valid('127.0.0.1').required(),
            username: Joi.any().forbidden(),
            password: Joi.any().forbidden(),
            port: Joi.any().forbidden()
        };
    }
};

const cloudSchema = {
    instanceType: Joi.string().valid([common.CLOUD_INSTANCE_TYPE_NORMAL, common.CLOUD_INSTANCE_TYPE_HIGH]).required(),
    cloud: Joi.string().valid(common.CLOUD_TYPE_ALICLOUD).required(),
    port: port
};

module.exports.bareOrganizationSchema = Joi.object().keys(Object.assign({
    mode: Joi.string().valid([common.RUNMODE_BARE]).required(),
    name: string,
    domainName: hostname,
    consortiumId: objectId
}, bareSchema()));

module.exports.cloudOrganizationSchema = Joi.object().keys(Object.assign({
    mode: Joi.string().valid([common.RUNMODE_CLOUD]).required(),
    name: string,
    domainName: hostname,
    consortiumId: objectId
}, cloudSchema));


