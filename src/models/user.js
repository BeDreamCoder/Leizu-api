/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    uuid: String,
    username: String,
    password: String,
    role_id: mongoose.Schema.ObjectId,
    date: Date,
    token: String,
    consortiumIDs:[mongoose.Schema.ObjectId],
    org_name: String
});

module.exports = mongoose.model('User', userSchema, 'user');
