/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const inviteRequest = {
    'mode':'bare',
    'org':{
        'name':'invite-org-local',
        'type':'0',
        'domainName':'invite-org',
        'host':'127.0.0.1',
        'enrollementID':'zhouxing',
        'enrollmentSecret':'zhouxingpwd'
    },
    'peers':[{
        'name':'invite-peer-local',
        'enrollementID':'zhoupeer',
        'enrollmentSecret':'zhouxingpwd'
    }]
};

const request = require('supertest');
const app = require('../../src/index');
const constants = require('./constants');
const token = 'Bearer ' + constants.token;

request(app.callback())
    .post('/api/v1/organization/invite')
    .set('Authorization', token)
    .send(inviteRequest)
    .expect(200)
    .end(function (err, response) {
        if (err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });
