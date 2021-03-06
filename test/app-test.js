/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

require('should');

const request = require('supertest');
const app = require('../src/index');

request(app.callback())
    .get('/')
    .expect(200)
    .end(function(err,response){
        if(err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });