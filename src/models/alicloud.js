/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const aliCloudSchema = new mongoose.Schema({
    uuid: String,
    instance: String,
    instance_type: String,
    vpc: String,
    region: String,
    zone: String,
    vswitch: String,
    security_group: String,
    public_ip_address: String,
    consortium_id: mongoose.Schema.ObjectId,
    creation_time: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AliCloud', aliCloudSchema, 'alicloud');