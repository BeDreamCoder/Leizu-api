/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const mongoose = require('../../src/libraries/db');
const AlicloudClient = require('../../src/services/provider/alicloud-client');

let client = new AlicloudClient('5c3b6a3be07c632c2e497f4f', 'cn-huhehaote');

client.run('ecs.c5.large', 1).then(result => {
    console.log('success:', result);
    mongoose.disconnect();
}).catch(err => {
    console.log('fail:', err);
    mongoose.disconnect();
});
