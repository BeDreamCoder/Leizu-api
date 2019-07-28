/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const chaincodeRecordSchema = new mongoose.Schema({
    uuid: String,
    consortium_id: mongoose.Schema.ObjectId,
    chaincode_id: mongoose.Schema.ObjectId,
    opt: {
        type: Number,
        default: 0
    },
    target: String,
    message: String,
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ChaincodeRecord', chaincodeRecordSchema, 'chaincodeRecord');