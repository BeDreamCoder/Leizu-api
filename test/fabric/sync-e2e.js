'use strict';

const request = require("supertest");
const app = require("../../src/index");

var consortiumId = '5bbb61a9aa736008edc6620e';
request(app.callback())
    .post("/api/v1/fabric/sync/" + consortiumId)
    .send({})
    .end(function(err,response){
        if(err) console.error(err);
        console.log(response.body);
        app.mongoose.disconnect();
    });

