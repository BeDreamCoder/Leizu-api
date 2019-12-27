/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const organizationSchema = new mongoose.Schema({
    uuid: String,
    name: String,
    domain_name: String,
    msp_id: String,
    admin_key: String,
    admin_cert: String,
    caname: String,
    url: String,
    root_cert: String,
    msp_path: String,
    consortium_id: mongoose.Schema.ObjectId,
    user_id: mongoose.Schema.ObjectId,
    type: {
        type: Number,
        default: 0
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Organization', organizationSchema, 'organization');
