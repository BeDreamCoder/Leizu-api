/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const request = require('supertest');
const app = require('../../src/index');
const constants = require('./constants');
const token = 'Bearer ' + constants.token;
const organization = {
    mode: 'bare',
    name: 'org3',
    domainName: 'org3.example.com',
    consortiumId: constants.consortiumId,
    host: '39.106.149.201',
    port: 22,
    username: 'root',
    password: '',
};

const cloudOrganization = {
    mode: 'cloud',
    name: 'org3',
    domainName: 'org3.example.com',
    consortiumId: constants.consortiumId,
    port: 22,
    instanceType: 'normal', // 'high'
    cloud: 'aliyun',
};

request(app.callback())
    .post('/api/v1/organization')
    .set('Authorization', token)
    .send(cloudOrganization)
    .end(function (err, response) {
        if (err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });
