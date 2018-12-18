/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const PeerService = require('../../services/fabric/peer');
const CAdvisorService = require('../../services/fabric/cadvisor');
const common = require('../../libraries/common');
const logger = require('../../libraries/log4js');
const router = require('koa-router')({prefix: '/peer'});
const Client = require('../../services/transport/client');
const config = require('../../env');

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
        ctx.body = common.success(peer, common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/', async ctx => {
    let res = Validator.JoiValidate('create peer', ctx.request.body, Schema.newPeerSchema);
    if (!res.result) throw new BadRequest(res.errMsg);
    try {
        let {organizationId, peers} = ctx.request.body;
        var eventPromises = [];
        for (let item of peers) {
            let txPromise = new Promise((resolve, reject) => {
                try {
                    item.organizationId = organizationId;
                    resolve(PeerService.create(item));

                } catch (e) {
                    reject(e.message);
                }
            });

            if (process.env.RUN_MODE === common.RUN_MODE.REMOTE) {
                let cadvisorItem = {
                    host: item.host,
                    username: item.username,
                    password: item.password
                };
                CAdvisorService.create(cadvisorItem);
            }
            eventPromises.push(txPromise);
        }
        await Promise.all(eventPromises).then(result => {
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

router.put('/:id', async ctx => {
    const id = ctx.params.id;
    try {
        await PeerService.joinChannel(id, ctx.request.body);
        ctx.body = common.success({id: id}, common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/check', async ctx => {
    const {host, username, password, port} = ctx.request.body;
    if (host && username && password) {
        try {
            let connectionOptions = {
                cmd: 'date',
                host: host,
                username: username,
                password: password,
                port: port || config.ssh.port
            };
            const client = Client.getInstance(connectionOptions);
            await client.exec();
            ctx.body = common.success('Successful connection detection.', common.SUCCESS);
        } catch (err) {
            logger.error(err);
            ctx.status = 400;
            ctx.body = common.error({}, err.message);
        }
    } else {
        ctx.status = 400;
        ctx.body = common.error({}, 'Missing peer ip, transport user name or password.');
    }
});

module.exports = router;
