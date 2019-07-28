/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const fs = require('fs');
const path = require('path');
const Multer = require('koa-multer');
const download = require('download');
const request = require('request');
const utils = require('../../libraries/utils');
const common = require('../../libraries/common');
const Validator = require('../../libraries/validator/validator');
const {BadRequest, SimpleBadRequest} = require('../../libraries/error');
const Schema = require('../../libraries/validator/schema/chaincode-schema');
const DbService = require('../../services/db/dao');
const ChaincodeService = require('../../services/fabric/chaincode/chaincode');
const chaincodeGoPath = path.join(process.env.GOPATH ? process.env.GOPATH : common.CHAINCODE_GOPATH, 'src');

const router = require('koa-router')({prefix: '/chaincode'});
router.get('/:consortiumId', async ctx => {
    let consortiumId = ctx.params.consortiumId;
    let res = Validator.JoiValidate('chaincode', ctx.params, Schema.consortiumChaincode);
    if (!res.result) throw new SimpleBadRequest(res.message);
    try {
        let chaincodes = await DbService.getChaincodeByFilter({consortium_id: consortiumId});
        let results = chaincodes.map(cc => {
            return {
                _id: cc._id,
                desc: cc.desc,
                version: cc.version,
                name: cc.name,
                peers: cc.peers ? cc.peers.length : 0,
                channels: cc.state ? Object.keys(cc.state).length : 0,
                status: cc.status,
                date: cc.date
            };
        });
        ctx.body = common.success(results, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/status/:chaincodeId', async ctx => {
    let chaincodeId = ctx.params.chaincodeId;
    let res = Validator.JoiValidate('chaincode', ctx.params, Schema.chaincodeId);
    if (!res.result) throw new SimpleBadRequest(res.message);
    try {
        let chaincode = await DbService.findChaincodeById(chaincodeId);
        if (!chaincode) throw new Error('The chaincode does not exist: ' + chaincodeId);
        let channels = await DbService.getChannelsByFilter({consortium_id: chaincode.consortium_id});
        let results = [];
        if (chaincode.peers) {
            results = channels.map(item => {
                let obj = {};
                let peerArr = [];
                for (let id of chaincode.peers) {
                    if (item.peers.indexOf(id) !== -1) {
                        peerArr.push(id);
                    }
                }
                if (peerArr && peerArr.length > 0) {
                    obj[item._id] = {peers: peerArr, state: 0};
                    return obj;
                }
            });
            if (chaincode.state) {
                for (let id of Object.keys(chaincode.state)) {
                    for (let key in results) {
                        if (results[key][id]) {
                            results[key][id].state = chaincode.state[id];
                            break;
                        }
                    }
                }
            }
        }
        let ret = [];
        for (let item of results) {
            if (!item) continue;
            for (let id of  Object.keys(item)) {
                let channel = await DbService.getChannelById(id);
                let obj = {};
                let peerArr = [];
                if (item[id] && item[id].peers && item[id].peers.length > 0) {
                    for (let v of item[id].peers) {
                        let peer = await DbService.findPeerById(v);
                        peerArr.push(utils.replacePeerName(peer.name));
                    }
                }
                obj[channel.name] = {peers: peerArr, state: item[id].state};
                ret.push(obj);
            }
        }

        ctx.body = common.success(JSON.stringify(ret), common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

function upload() {
    return Multer({
        storage: Multer.diskStorage({
            // Upload file path setting, uploads folder will be automatically created.
            destination: (req, file, cb) => {
                let filePath = path.join(chaincodeGoPath, common.CHAINCODE_PATH,
                    path.basename(file.originalname, '.go'), Date.now().toString());
                if (fs.existsSync(filePath)) {
                    cb(new Error('The chaincode already exists'));
                } else {
                    utils.createDir(filePath);
                    cb(null, filePath);
                }
            },
            // Rename the uploaded file to get the suffix name
            filename: (req, file, cb) => {
                cb(null, file.originalname);
            }
        }),
        // Filter files in illegal formats
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            if (ext !== '.go') {
                cb(new Error('Files in this format are not allowed to be uploaded'));
            } else {
                cb(null, true);
            }
        },
        limits: {fileSize: common.CHAINCODE_UPLOAD_MAX_SIZE}
    }).single('chaincode');
}

// upload chaincode file
router.post('/upload', upload(), async ctx => {
    try {
        let res = Validator.JoiValidate('chaincode', ctx.req.body, Schema.upload);
        if (!res.result) throw new BadRequest(res.errMsg);
        let params = ctx.req.body;
        let chaincodePath = ctx.req.file.destination.split(chaincodeGoPath + '/')[1];
        if (!chaincodePath) {
            throw new Error('Chaincode upload failed');
        }
        params.chaincodePath = chaincodePath;
        let result = await ChaincodeService.uploadChaincode(params);
        ctx.body = common.success(result, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/install', async ctx => {
    let {chaincodeId, peers} = ctx.request.body;
    let res = Validator.JoiValidate('chaincode', ctx.request.body, Schema.install);
    if (!res.result) throw new BadRequest(res.errMsg);
    let results = [];
    try {
        for (let id of peers) {
            let peer = await DbService.findPeerById(id);
            if (!peer) throw new Error('The peer does not exist: ' + id);
            let chaincodeService = await ChaincodeService.getInstance(chaincodeId, [id]);
            let result = await chaincodeService.installChaincode(utils.replacePeerName(peer.name));
            results = results.concat(result);
        }
        ctx.body = common.success(results, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        results.push(err.message);
        ctx.body = common.error({}, results);
    }
});

router.post('/deploy', async ctx => {
    let {chaincodeId, channelIds, functionName, args, policyType} = ctx.request.body;
    let res = Validator.JoiValidate('chaincode', ctx.request.body, Schema.instantiateAndUpgrade);
    if (!res.result) throw new BadRequest(res.errMsg);
    try {
        let succeed = [];
        let failed = [];
        for (let channelId of channelIds) {
            let chaincodeService = await ChaincodeService.getInstance(chaincodeId);
            let result = await chaincodeService.instantiateAndUpgradeChaincode(channelId, functionName, args, 'instantiate', policyType);
            if (result.success) {
                succeed.push(result.target);
            } else {
                failed.push(result.target);
            }
        }
        if (failed.length === 0) {
            ctx.body = common.success({succeed: succeed}, common.SUCCESS);
        } else {
            throw new Error(JSON.stringify({succeed: succeed, failed: failed}));
        }
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/upgrade', async ctx => {
    let {chaincodeId, channelIds, functionName, args, policyType} = ctx.request.body;
    let res = Validator.JoiValidate('chaincode', ctx.request.body, Schema.instantiateAndUpgrade);
    if (!res.result) throw new BadRequest(res.errMsg);
    try {
        let succeed = [];
        let failed = [];
        for (let channelId of channelIds) {
            let chaincodeService = await ChaincodeService.getInstance(chaincodeId);
            let result = await chaincodeService.instantiateAndUpgradeChaincode(channelId, functionName, args, 'upgrade', policyType);
            if (result.success) {
                succeed.push(result.target);
            } else {
                failed.push(result.target);
            }
        }
        if (failed.length === 0) {
            ctx.body = common.success({succeed: succeed}, common.SUCCESS);
        } else {
            throw new Error(JSON.stringify({succeed: succeed, failed: failed}));
        }
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/invoke', async ctx => {
    let {chaincodeId, channelId, functionName, args} = ctx.request.body;
    try {
        let chaincodeService = await ChaincodeService.getInstance(chaincodeId);
        let result = await chaincodeService.invokeChaincode(channelId, functionName, args);
        ctx.body = common.success(result, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/query', async ctx => {
    let {chaincodeId, channelId, functionName, args} = ctx.request.body;
    try {
        let chaincodeService = await ChaincodeService.getInstance(chaincodeId);
        let result = await chaincodeService.queryChaincode(channelId, functionName, args);
        ctx.body = common.success(result, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.get('/record/:consortiumId', async ctx => {
    let consortiumId = ctx.params.consortiumId;
    let res = Validator.JoiValidate('chaincode', ctx.params, Schema.consortiumChaincode);
    if (!res.result) throw new SimpleBadRequest(res.message);
    try {
        let record = await DbService.getChaincodeRecordByFilter({consortium_id: consortiumId});
        ctx.body = common.success(record, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/record-cc/:chaincodeId', async ctx => {
    let chaincodeId = ctx.params.chaincodeId;
    try {
        let record = await DbService.getChaincodeRecordByFilter({chaincode_id: chaincodeId});
        ctx.body = common.success(record, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/peers/:chaincodeId', async ctx => {
    try {
        let chaincodeId = ctx.params.chaincodeId;
        let res = Validator.JoiValidate('chaincode', ctx.params, Schema.chaincodeId);
        if (!res.result) throw new SimpleBadRequest(res.message);
        let cc = await DbService.findChaincodeById(chaincodeId);
        if (!cc) {
            throw new Error('The chaincode does not exist: ' + chaincodeId);
        }
        let peers = await DbService.findPeersByConsortiumId(cc.consortium_id, common.PEER_TYPE_PEER);
        let results = [];
        for (let item of peers) {
            if (cc.peers && cc.peers.length > 0 && cc.peers.indexOf(item._id) !== -1) {
                continue;
            }
            results.push({
                _id: item._id,
                name: utils.replacePeerName(item.name)
            });
        }
        ctx.body = common.success(results, common.SUCCESS);
    } catch (ex) {
        ctx.status = 400;
        ctx.body = common.error(null, ex.message);
    }
});

router.get('/channel/:chaincodeId', async ctx => {
    let res = Validator.JoiValidate('chaincode', ctx.params, Schema.chaincodeId);
    if (!res.result) throw new SimpleBadRequest(res.message);
    res = Validator.JoiValidate('chaincode', ctx.query, Schema.chaincodeAction);
    if (!res.result) throw new SimpleBadRequest(res.message);
    let chaincodeId = ctx.params.chaincodeId;
    let type = ctx.query.type;
    try {
        let chaincode = await DbService.findChaincodeById(chaincodeId);
        if (!chaincode) throw new Error('The chaincode does not exist: ' + chaincodeId);
        let channels = await DbService.getChannelsByFilter({consortium_id: chaincode.consortium_id});
        let results = [];
        if (chaincode.peers && chaincode.peers.length > 0) {
            let chaincodes = await DbService.getChaincodeByFilter({
                consortium_id: chaincode.consortium_id,
                name: chaincode.name,
            });
            let existChannels = [];
            for (let item of chaincodes) {
                if (!item.state) {
                    continue;
                }
                let keys = Object.keys(item.state);
                for (let v of keys) {
                    if (existChannels.indexOf(v) !== -1) {
                        continue;
                    }
                    existChannels.push(v);
                }
            }
            if (type === common.CHAINCODE_UPGRADE) {
                if (chaincode.state) {
                    let keys = Object.keys(chaincode.state);
                    for (let v of keys) {
                        if (chaincode.state[v] >= common.CHAINCODE_STATE_DEPLOYED) {
                            existChannels.splice(v, 1);
                        }
                    }
                }
            }

            results = channels.map(item => {
                if (type === common.CHAINCODE_DEPLOY && existChannels.indexOf(String(item._id)) !== -1) {
                    return;
                } else if (type === common.CHAINCODE_UPGRADE && existChannels.indexOf(String(item._id)) === -1) {
                    return;
                }
                for (let id of chaincode.peers) {
                    if (item.peers.indexOf(id) !== -1) return item._id;
                }
            });
        }
        let ret = [];
        for (let item of results) {
            if (!item) continue;
            let channel = await DbService.getChannelById(item);
            let obj = {};
            obj[channel.name] = item;
            ret.push(obj);
        }
        ctx.body = common.success(JSON.stringify(ret), common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/upload-url', async ctx => {
    try {
        let res = Validator.JoiValidate('chaincode', ctx.request.body, Schema.uploadUrl);
        if (!res.result) throw new BadRequest(res.errMsg);
        let params = ctx.request.body;
        let filePath = path.join(chaincodeGoPath, common.CHAINCODE_PATH,
            params.chaincodeName, Date.now().toString());
        if (fs.existsSync(filePath)) {
            throw new Error('The chaincode already exists');
        } else {
            utils.createDir(filePath);
        }
        if (params.token) {
            await request.get({
                uri: params.chaincodeUrl,
                headers: {authorization: 'Bearer ' + params.token}
            }).pipe(fs.createWriteStream(`${filePath}/${params.chaincodeName}.go`));
        } else {
            await download(params.chaincodeUrl, filePath);
        }
        let chaincodePath = filePath.split(chaincodeGoPath + '/')[1];
        if (!chaincodePath) {
            throw new Error('Chaincode upload failed');
        }
        params.chaincodePath = chaincodePath;
        let result = await ChaincodeService.uploadChaincode(params);
        ctx.body = common.success(result, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

module.exports = router;