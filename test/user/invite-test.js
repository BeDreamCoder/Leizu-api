/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const invite = {
    name:'zhou',
    contactname:'zhouxing'
};

const request = require('supertest');
const app = require('../../src/index');
const token = 'Bearer ' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVkZGY0MTQ2YzJjZGEwY2VmZWNjOWNhMyIsImlhdCI6MTU3Njc0MjM5NywiZXhwIjoxNTc2Nzc4Mzk3fQ.kJvB8QZroZLTvqL68GC5piPswhr57TTnG_5AXThrXmw';
request(app.callback())
    .post('/api/v1/user/invite')
    .set('authorization', token)
    .send(invite)
    .expect(200)
    .end(function (err, response) {
        if (err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });
