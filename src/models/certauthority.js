/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const certAuthoritySchema = new mongoose.Schema({
    uuid: String,
    enrollment_id: String,
    enrollment_secret: String,
    role: String,
    keystore: String,
    signcerts: String,
    org_id: mongoose.Schema.ObjectId,
    consortium_id: mongoose.Schema.ObjectId,
    profile: String,
    is_root: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CertAuthority', certAuthoritySchema, 'certauthority');
