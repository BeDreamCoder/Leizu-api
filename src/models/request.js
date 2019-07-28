/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const requestSchema = new mongoose.Schema({
    uuid: String,
    name: String,
    status: String,
    configuration: String,
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Request', requestSchema, 'request');