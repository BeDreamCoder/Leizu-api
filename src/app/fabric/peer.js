/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const DbService = require('../../services/db/dao');
const PeerService = require('../../services/fabric/peer');
const CAdvisorService = require('../../services/fabric/cadvisor');
const common = require('../../libraries/common');
const utils = require('../../libraries/utils');
const logger = require('../../libraries/log4js');
const router = require('koa-router')({prefix: '/peer'});

const {BadRequest} = require('../../libraries/error');
const Validator = require('../../libraries/validator/validator');
const Schema = require('../../libraries/validator/schema/peer-schema');

router.get('/:consortiumId', async ctx => {
    try {
        const peerDetails = await PeerService.list(ctx.query['organizationId'], ctx.params.consortiumId);
        ctx.body = common.success(peerDetails, common.SUCCESS);
    } catch (ex) {
        logger.error(ex);
        ctx.status = 400;
        ctx.body = common.error(null, ex.message);
    }
});

router.get('/:consortiumId/:id', async ctx => {
    try {
        const peer = await PeerService.findByIdAndConsortiumId(ctx.params.id, ctx.params.consortiumId);
        peer.name = utils.replacePeerName(peer.name);
        ctx.body = common.success(peer, common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/', async ctx => {
    let params = ctx.request.body;
    let res;
    if (params.mode === common.RUNMODE_CLOUD) {
        res = Validator.JoiValidate('create peer', params, Schema.cloudPeerSchema);
    } else {
        res = Validator.JoiValidate('create peer', params, Schema.barePeerSchema);
    }
    if (!res.result) throw new BadRequest(res.errMsg);
    try {
        let {mode, organizationId, peers, channelId} = ctx.request.body;
        if (channelId) {
            const channel = await DbService.getChannelById(channelId);
            if (!channel) {
                throw new Error('The channel does not exist: ' + channelId);
            }
        }
        peers = await PeerService.handleAlicloud(mode, organizationId, peers);
        var eventPromises = [];
        for (let item of peers) {
            // run metrics server
            if (process.env.RUN_MODE === common.RUN_MODE.REMOTE) {
                let cadvisorItem = {
                    host: item.host,
                    username: item.username,
                    password: item.password
                };
                CAdvisorService.create(cadvisorItem);
            }

            let txPromise = new Promise((resolve, reject) => {
                try {
                    item.organizationId = organizationId;
                    resolve(PeerService.create(item));

                } catch (e) {
                    reject(e.message);
                }
            });

            eventPromises.push(txPromise);
        }
        await Promise.all(eventPromises).then(async result => {
            let peerIds = result.map(item => String(item._id));
            await PeerService.checkChannel(organizationId, peerIds, channelId);
            ctx.body = common.success(result, common.SUCCESS);
        }, err => {
            throw err;
        });
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/check', async ctx => {
    let res = Validator.JoiValidate('check peer status', ctx.request.body, Schema.checkPeerStatusSchema);
    if (!res.result) throw new BadRequest(res.errMsg);
    try {
        await PeerService.checkStatus(ctx.request.body);
        ctx.body = common.success('Successful connection detection.', common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

module.exports = router;
