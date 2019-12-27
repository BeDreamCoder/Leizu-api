/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';
let Joi = require('joi');

const userNameSchema = Joi.string().min(4).max(50).required();
const passwordSchema = Joi.string().min(4).max(20).required();

module.exports.loginSchema = Joi.object().options({abortEarly: false}).keys({
    username: userNameSchema,
    password: passwordSchema,
});

module.exports.resetSchema = Joi.object().options({abortEarly: false}).keys({
    username: userNameSchema,
    password: passwordSchema,
    newPassword: passwordSchema.valid(Joi.ref('password')).options({language: {any: {allowOnly: 'must match password'}}})
});

module.exports.registerSchema = Joi.object().options({abortEarly: false}).keys({
    username: userNameSchema,
    password: passwordSchema,
    repassword: passwordSchema,
    orgName: Joi.string().min(4).max(255).required(),
    inviteCode: Joi.string().regex(/^[a-zA-Z0-9]{6}$/)
});

module.exports.createInvite = Joi.object().keys({
    name: Joi.string().min(4).max(255).required(),
    contactname:Joi.string().min(4).max(255).required(),
    consortium_id:Joi.string().min(4).max(255).required(),
    channel_id:Joi.string().min(4).max(255).required()
});
