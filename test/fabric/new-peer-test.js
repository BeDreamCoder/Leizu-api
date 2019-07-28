/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const request = require('supertest');
const app = require('../../src/index');
const constants = require('./constants');
const token = 'Bearer ' + constants.token;

const peer = {
    mode: 'bare',
    organizationId: constants.organizationId,
    peers: [{
        name: 'peer1',
        image: 'hyperledger/fabric-ca-peer',
        host: '39.106.149.201',
        port: 22,
        username: 'root',
        password: '',
    }]
};

const cloudPeer = {
    mode: 'cloud',
    organizationId: constants.organizationId,
    peers: [{
        name: 'peer1',
        image: 'hyperledger/fabric-ca-peer',
        instanceType: 'normal', // 'high'
        cloud: 'aliyun',
        port: 22,

    }]
};

request(app.callback())
    .post('/api/v1/peer')
    .set('Authorization', token)
    .send(cloudPeer)
    .end((err, response) => {
        if (err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });
