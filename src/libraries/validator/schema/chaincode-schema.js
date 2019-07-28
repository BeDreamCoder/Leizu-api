/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Joi = require('joi');
const {objectId, string} = require('./schema-utils');
const Common = require('../../common');

module.exports.consortiumChaincode = Joi.object().options({abortEarly: true}).keys({
    consortiumId: objectId
});

module.exports.chaincodeId = Joi.object().options({abortEarly: true}).keys({
    chaincodeId: objectId
});

module.exports.upload = Joi.object().keys({
    consortiumId: objectId,
    chaincodeName: string,
    chaincodeVersion: string,
    chaincodeDesc: string
});

module.exports.uploadUrl = Joi.object().keys({
    consortiumId: objectId,
    chaincodeName: string,
    chaincodeVersion: string,
    chaincodeDesc: string,
    chaincodeUrl: string,
    token: Joi.string()
});

module.exports.install = Joi.object().keys({
    chaincodeId: objectId,
    peers: Joi.array().min(1).items(objectId).required().sparse(false)
});

module.exports.instantiateAndUpgrade = Joi.object().keys({
    chaincodeId: objectId,
    channelIds: Joi.array().min(1).items(objectId).required().sparse(false),
    args: Joi.array().optional(),
    policyType: string
});


module.exports.chaincodeAction = Joi.object().keys({
    type: Joi.string().valid(Common.CHAINCODE_DEPLOY, Common.CHAINCODE_UPGRADE).required(),
});
