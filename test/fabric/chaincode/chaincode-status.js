/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const request = require('supertest');
const app = require('../../../src/index');
const constants = require('../constants');
const token = 'Bearer ' + constants.token;

request(app.callback())
    .get('/api/v1/chaincode/status/5c344643c22c4645868903b8')
    .set('Authorization', token)
    .end(function (err, response) {
        if (err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });