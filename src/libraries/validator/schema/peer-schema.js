/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Joi = require('joi');
const {objectId, string, ip, port, unRequiredObjectId} = require('./schema-utils');
// const config = require('../../../env');
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

module.exports.barePeerSchema = Joi.object().keys({
    mode: Joi.string().valid([common.RUNMODE_BARE]).required(),
    organizationId: objectId,
    peers: Joi.array().min(1).items(Joi.object().keys(Object.assign({
        name: string,
        // image: Joi.string().valid(config.network.peer.availableImages),
    }, bareSchema()))).required(),
    channelId: unRequiredObjectId,
});

module.exports.cloudPeerSchema = Joi.object().keys({
    mode: Joi.string().valid([common.RUNMODE_CLOUD]).required(),
    organizationId: objectId,
    peers: Joi.array().min(1).items(Joi.object().keys(Object.assign({
        name: string,
        // image: Joi.string().valid(config.network.peer.availableImages),
    }, cloudSchema))).required(),
    channelId: unRequiredObjectId,
});

module.exports.checkPeerStatusSchema = Joi.object().keys(bareSchema());
