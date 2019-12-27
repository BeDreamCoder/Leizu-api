/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Joi = require('joi');
const {objectId, string, hostname, ip, port} = require('./schema-utils');
const utils = require('../../utils');
const common = require('../../common');
const userNameSchema = Joi.string().min(4).max(50).required();
const passwordSchema = Joi.string().min(4).max(20).required();

const bareSchema = () => {
    if (!utils.isStandalone()) {
        return {
            host: ip,
            username: string,
            password: string,
            port: port
        };
    } else {
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
    consortiumId: objectId,
}, bareSchema()));

module.exports.cloudOrganizationSchema = Joi.object().keys(Object.assign({
    mode: Joi.string().valid([common.RUNMODE_CLOUD]).required(),
    name: string,
    domainName: hostname,
    consortiumId: objectId,
}, cloudSchema));

module.exports.registerBareOrganizationSchema = Joi.object().keys(Object.assign({
    mode: Joi.string().valid([common.RUNMODE_BARE]).required(),
    name: string,
    domainName: hostname,
    consortiumId: objectId,
    enrollmentID: userNameSchema,
    enrollmentSecret: passwordSchema,
    reEnrollmentSecret: passwordSchema,
    inviteCode: Joi.string().regex(/^[a-zA-Z0-9]{6}$/)
}, bareSchema()));

module.exports.registerCloudOrganizationSchema = Joi.object().keys(Object.assign({
    mode: Joi.string().valid([common.RUNMODE_CLOUD]).required(),
    name: string,
    domainName: hostname,
    consortiumId: objectId,
    enrollmentID: userNameSchema,
    enrollmentSecret: passwordSchema,
    reEnrollmentSecret: passwordSchema,
    inviteCode: Joi.string().regex(/^[a-zA-Z0-9]{6}$/),
}, cloudSchema));

module.exports.bareInviteOrganizationSchema = Joi.object().keys({
    mode: Joi.string().valid([common.RUNMODE_BARE]).required(),
    org: Joi.object().keys(Object.assign({
        name: string,
        domainName: hostname,
        enrollementID: string,
        enrollmentSecret: string,
    }, bareSchema())).required(),
    peers: Joi.array().min(1).items(Joi.object().keys(Object.assign({
        name: string,
        enrollementID: string,
        enrollmentSecret: string
    }, bareSchema()))).required()
});

module.exports.cloudInviteOrganizationSchema = Joi.object().keys({
    mode: Joi.string().valid([common.RUNMODE_CLOUD]).required(),
    org: Joi.object().keys(Object.assign({
        name: string,
        domainName: hostname,
        enrollementID: string,
        enrollmentSecret: string
    }, cloudSchema)),
    peers: Joi.array().min(1).items(Joi.object().keys(Object.assign({
        name: string,
        enrollementID: string,
        enrollmentSecret: string
    }, cloudSchema)))
});
