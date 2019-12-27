/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Joi = require('joi');
const {string, ip, cloudSchema} = require('./schema-utils');
const utils = require('../../utils');
const Common = require('../../common');

const bareSchema = () => {
    if (!utils.isStandalone()) {
        return {
            name: string,
            ip: ip,
            ssh_username: string,
            ssh_password: string,
        };
    } else {
        return {
            name: string,
            ip: Joi.string().valid('127.0.0.1').required(),
            ssh_username: Joi.any().forbidden(),
            ssh_password: Joi.any().forbidden(),
        };
    }
};

const consensusCondition = {
    is: Common.CONSENSUS_KAFKA,
    then: Joi.required()
};

const ordererSchema = Joi.alternatives()
    .when('mode', {
        is: Common.RUNMODE_CLOUD,
        then: Joi.object().keys({
            name: string,
            ca: cloudSchema,
            orderer: Joi.array().min(1).items(cloudSchema).required().sparse(false),
        }).required(),
        otherwise: Joi.object().keys({
            name: string,
            ca: Joi.object().keys(bareSchema()),
            orderer: Joi.array().min(1).items(Joi.object().keys(bareSchema())).required().sparse(false),
        }).required()
    });

const peerSchema = Joi.alternatives().when('mode', {
    is: Common.RUNMODE_CLOUD,
    then: Joi.array().min(1).items({
        name: string,
        ca: cloudSchema,
        peers: Joi.array().min(1).items(cloudSchema).required().sparse(false)
    }).required(),
    otherwise: Joi.array().min(1).items({
        name: string,
        ca: Joi.object().keys(bareSchema()),
        peers: Joi.array().min(1).items(Joi.object().keys(bareSchema())).required().sparse(false)
    }).required(),
});
const kafkaSchema = Joi.alternatives().when('mode', {
    is: Common.RUNMODE_CLOUD,
    then: Joi.array().items(cloudSchema).when('consensus', consensusCondition),
    otherwise: Joi.array().items(Joi.object().keys(bareSchema())).when('consensus', consensusCondition),
});
const zookeeperSchema = Joi.alternatives().when('mode', {
    is: Common.RUNMODE_CLOUD,
    then: Joi.array().items(cloudSchema).when('consensus', consensusCondition),
    otherwise: Joi.array().items(Joi.object().keys(bareSchema())).when('consensus', consensusCondition),
});

module.exports.requestSchema = Joi.object().options({}).keys({
    name: Joi.string().min(4).max(255).required(),
    type: Joi.string().valid(Common.BLOCKCHAIN_TYPE_LIST).required(),
    version: Joi.string().valid(Common.VERSION_LIST).required(),
    db: Joi.string().valid(Common.DB_TYPE_LIST).required(),
    consensus: Joi.string().valid(Common.CONSENSUS_LIST).required(),
    mode: Joi.string().valid([Common.RUNMODE_CLOUD, Common.RUNMODE_BARE]).required(),
    network: Joi.string().valid([Common.CLOUD_NETWORK_CLASSICS, Common.CLOUD_NETWORK_VPC]).when('mode', {
        is: Common.RUNMODE_CLOUD, then: Joi.required()
    }),
    normalInstanceLimit: Joi.number().when('mode', {
        is: Common.RUNMODE_CLOUD, then: Joi.required()
    }),
    highInstanceLimit: Joi.number().when('mode', {
        is: Common.RUNMODE_CLOUD, then: Joi.required()
    }),
    kafka: kafkaSchema,
    zookeeper: zookeeperSchema,
    ordererOrg: ordererSchema,
    peerOrgs: peerSchema,
    channel: Joi.object().keys({
        name: string,
        orgs: Joi.array().min(1).unique().items(string).required().sparse(false)
    }).required()
});
