/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const logger = require('../../libraries/log4js');
const common = require('../../libraries/common');
const RequestHandler = require('../../services/handler/request');
const router = require('koa-router')({prefix: '/request'});
const {BadRequest} = require('../../libraries/error');
const Validator = require('../../libraries/validator/validator');
const Schema = require('../../libraries/validator/schema/request-schema');

router.post('/', async ctx => {
    let res = Validator.JoiValidate('request', ctx.request.body, Schema.requestSchema);
    if (!res.result) throw new BadRequest(res.errMsg);
    try {
        ctx.request.socket.setTimeout(common.REQUEST_TIMEOUT_UNLIMITED);
        let requestHandler = new RequestHandler(ctx);
        let request = await requestHandler.handle();
        let simpleResponse = {
            id: request._id,
            name: request.name,
            consortiumId: request.consortiumId
        };
        ctx.body = common.success(simpleResponse, common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message || err);
    }
});

module.exports = router;
