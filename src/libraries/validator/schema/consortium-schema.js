/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Joi = require('joi');
const SchemaUtils = require('./schema-utils');

//TODO: need to confirm
module.exports.createConsortium = Joi.object().keys({
    name: Joi.string().min(4).max(255).required(),
}).unknown(true);

module.exports.getConsortium = Joi.object().keys({
    id: SchemaUtils.objectId
}).unknown(true);


module.exports.dynamicConfig = Joi.object().options({}).keys({
    id: SchemaUtils.objectId,
    normalInstanceLimit: Joi.number().required(),
    highInstanceLimit: Joi.number().required(),
});

module.exports.getConsortiumBlocks = Joi.object().keys({
    limit: Joi.number().min(1).max(30),
}).unknown(true);

module.exports.getConsortiumTransactions = Joi.object().keys({
    limit: Joi.number().min(1).max(50),
}).unknown(true);

module.exports.getConsortiumBlock = Joi.object().keys({
    blockNumber: Joi.number().required(),
}).unknown(true);

module.exports.consortiumSearch = Joi.object().keys({
    q: Joi.string().required(),
}).unknown(true);
