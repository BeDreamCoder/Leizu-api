/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Joi = require('joi');
const Common = require('../../common');

const objectId = Joi.string().length(24).required();
const string = Joi.string().required();
const hostname = Joi.string().hostname().required();
const port = Joi.number().port();
const ip = Joi.string().ip().required();
const unRequiredObjectId = Joi.string().length(24);
const cloudSchema = Joi.object().keys({
    name: string,
    type: Joi.string().valid([Common.CLOUD_INSTANCE_TYPE_NORMAL, Common.CLOUD_INSTANCE_TYPE_HIGH]).required(),
    cloud: Joi.string().valid(Common.CLOUD_TYPE_ALICLOUD).required()
}).required();

module.exports = {
    objectId,
    string,
    hostname,
    port,
    ip,
    unRequiredObjectId,
    cloudSchema
};
