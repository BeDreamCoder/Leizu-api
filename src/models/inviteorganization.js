/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('mongoose');
const inviteorganizationSchema = new mongoose.Schema({
    uuid: String,
    name: String,
    contactname:String,
    inviteCode:String,
    status:String,
    consortiumId: mongoose.Schema.ObjectId,
    channelId:  mongoose.Schema.ObjectId,
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('InviteOrganization', inviteorganizationSchema, 'inviteorganization');
