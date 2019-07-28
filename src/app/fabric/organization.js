/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('../../libraries/utils');
const common = require('../../libraries/common');
const DbService = require('../../services/db/dao');
const OrganizationService = require('../../services/fabric/organization');
const router = require('koa-router')({prefix: '/organization'});
const send = require('koa-send');
const archiver = require('archiver');
const {BadRequest} = require('../../libraries/error');
const Validator = require('../../libraries/validator/validator');
const Schema = require('../../libraries/validator/schema/organization-shcema');

router.get('/:consortiumId', async ctx => {
    let channelId = ctx.query['channelId'];
    let consortiumId = ctx.params.consortiumId;
    let filter = {consortium_id: consortiumId};
    let type = ctx.query['type'];
    if (type) filter.type = type;
    let orgList = [];
    let orgIds = [];
    if (channelId) {
        try {
            let channel = await DbService.getChannelByFilter({_id: channelId, consortium_id: consortiumId});
            if (channel) {
                filter._id = channel.orgs;
            }
        } catch (err) {
            ctx.status = 400;
            ctx.body = common.error([], err.message);
        }
    }
    try {
        let organizations = await DbService.getOrganizationsByFilter(filter);
        if (organizations) {
            orgIds = organizations.map(item => {
                orgList.push({
                    id: item._id,
                    name: item.name,
                    type: item.type,
                    consortium_id: item.consortium_id,
                    peer_count: 0
                });
                return item._id;
            });
            let peerCounts = await DbService.countPeersByOrg(orgIds);
            orgIds = orgIds.map(id => String(id));
            peerCounts.map(item => {
                let idx = orgIds.indexOf(String(item._id));
                orgList[idx].peer_count = item.total;
            });
            ctx.body = common.success(orgList, common.SUCCESS);
        }
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/download/certificate', async ctx => {
    let id = ctx.query.id;
    let type = parseInt(ctx.query.type);
    try {
        let organization = await DbService.findOrganizationById(id);
        if (!organization) {
            throw new Error('The organization does not exist: ' + id);
        }
        let archive = archiver('zip', {
            zlib: {level: 9}
        });
        let zipName;
        if (type === common.DOWNLOAD_ENTERPRISE_CERT) {
            let fileName = `${organization.name}-enterprise-certificate`;
            zipName = `download/${fileName}.zip`;
            let zipStream = fs.createWriteStream(zipName);
            archive.pipe(zipStream);
            archive.append(Buffer.from(organization.admin_key), {name: `${fileName}/admincerts/cert.pem`});
            archive.append(Buffer.from(organization.admin_cert), {name: `${fileName}/keystore/private_key`});
        } else if (type === common.DOWNLOAD_CA_CERT) {
            let fileName = `${organization.name}-ca-certificate`;
            zipName = `download/${fileName}.zip`;
            let zipStream = fs.createWriteStream(zipName);
            archive.pipe(zipStream);
            archive.append(Buffer.from(organization.root_cert), {name: `${fileName}/tlscacerts/cert.pem`});
        } else {
            throw new Error('Invalid certificate type.');
        }
        await archive.finalize();
        ctx.attachment(zipName);
        await send(ctx, zipName);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/:consortiumId/:id', async ctx => {
    let id = ctx.params.id;
    let consortiumId = ctx.params.consortiumId;
    try {
        let organization = await DbService.findOrganizationByFilter({_id: id, consortium_id: consortiumId});
        ctx.body = common.success(organization, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/', async ctx => {
    let params = ctx.request.body;
    let res;
    if (params.mode === common.RUNMODE_CLOUD) {
        res = Validator.JoiValidate('create organization', params, Schema.cloudOrganizationSchema);
    } else {
        res = Validator.JoiValidate('create organization', params, Schema.bareOrganizationSchema);
    }
    if (!res.result) throw new BadRequest(res.errMsg);
    try {
        params = await OrganizationService.handleAlicloud(params);
        let organization = await OrganizationService.create(params);
        ctx.body = common.success({
            _id: organization._id,
            name: organization.name,
            msp_id: organization.msp_id,
            msp_path: organization.msp_path,
            uuid: organization.uuid,
            date: organization.date
        }, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

module.exports = router;
