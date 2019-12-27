/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const register = {
    username:'starzhou',
    password:'zhouxing',
    repassword:'zhouxing',
    orgName:'starxx',
    inviteCode:'b4dK7v'
};

const request = require('supertest');
const app = require('../../src/index');
request(app.callback())
    .post('/api/v1/user/register')
    .set('x-request-from','BaaS')
    .send(register)
    .expect(200)
    .end(function (err, response) {
        if (err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });
