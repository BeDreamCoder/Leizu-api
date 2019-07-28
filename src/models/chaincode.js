/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const chaincodeSchema = new mongoose.Schema({
    uuid: String,
    consortium_id: mongoose.Schema.ObjectId,
    name: String,
    path: String,
    version: String,
    desc: String,
    type: String,
    peers: [mongoose.Schema.ObjectId],
    status: {
        type: Number,
        default: 0
    },
    state: JSON, // {channel: mongoose.Schema.ObjectId, state: 0}
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Chaincode', chaincodeSchema, 'chaincode');