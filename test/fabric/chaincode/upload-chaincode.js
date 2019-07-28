/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const path = require('path');
const request = require('supertest');
const app = require('../../../src/index');
const constants = require('../constants');
const token = 'Bearer ' + constants.token;

request(app.callback())
    .post('/api/v1/chaincode/upload')
    .set('Content-Type', 'multipart/form-data')
    .set('Authorization', token)
    .field('consortiumId', '5c3445d18e68234561a357dc')
    .field('chaincodeName', 'example_cc')
    .field('chaincodeVersion', 'v2')
    .field('chaincodeDesc', '示例合约')
    .attach('chaincode', path.join(__dirname, 'go/example_cc.go'))
    .end(function (err, response) {
        if (err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });

// const chaincode = {
//     consortiumId: '5c3b6a3be07c632c2e497f4f',
//     chaincodeName: 'example_cc',
//     chaincodeVersion: 'v0',
//     chaincodeDesc: '示例合约',
//     chaincodeUrl: 'http://dev.baas.ziggurat.cn:8882/upload/8c8e37175621a4f6aa9e128e9fd34661.go'
// };
// request(app.callback())
//     .post('/api/v1/chaincode/upload-url')
//     .set('Authorization', token)
//     .send(chaincode)
//     .end(function (err, response) {
//         if (err) console.error(err);
//         console.log(response.body);
//         app.mongoose.disconnect();
//     });

