/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const logger = require('../../libraries/log4js');
const common = require('../../libraries/common');
const DbService = require('../../services/db/dao');
const consortiumService = require('../../services/fabric/consortium');
const QueryService = require('../../services/fabric/query');
const Validator = require('../../libraries/validator/validator');
const {BadRequest} = require('../../libraries/error');
const Schema = require('../../libraries/validator/schema/consortium-schema');
const utils = require('../../libraries/utils');
const config = require('../../middlewares/config');
const router = require('koa-router')({prefix: '/consortium'});

router.get('/network-config', async ctx => {
    try {
        let consortiums = await DbService.getConsortiums();
        if (consortiums && consortiums.length) {
            let consortium = consortiums[0];
            let networkConfig = {
                name: consortium.name,
                'x-type': 'hlfv1',
                version: '1.0',
            };
            let channel = await DbService.getChannelByFilter({
                consortium_id: consortium._id,
            });
            if (channel) {
                //fetch peer orgs
                let peerOrgs = await DbService.findOrganizationByFilter({
                    consortium_id: consortium._id,
                    type: common.PEER_TYPE_PEER,
                });
                if (peerOrgs && peerOrgs.length) {
                    let organizations = {};
                    let peers = {};
                    for (let org of peerOrgs) {
                        let _peers = await DbService.findPeersByFilter({
                            consortium_id: consortium._id,
                            org_id: org._id,
                            type: common.PEER_TYPE_PEER,
                        });
                        let cas = await DbService.findCaByFilter({
                            consortium_id: consortium._id,
                            org_id: org._id,
                        });
                        organizations[org.name] = {
                            mspid: org.msp_id,
                            peers: _peers.map(peer => `${peer.name}.${org.domain_name}`),
                            certificateAuthorities: cas.map(ca => ca.name),
                            adminPrivateKey: {
                                pem: org.admin_key
                            },
                            signedCert: {
                                pem: org.admin_cert
                            },
                        };
                        _peers.map(peer => Object.assign(peers, {
                            [`${peer.name}.${org.domain_name}`]: {
                                url: `grpc://${peer.location}`,
                                grpcOptions: {
                                    'ssl-target-name-override': `${peer.name}.${org.domain_name}`
                                },
                                tlsCACerts: {
                                    pem: peer.tls_cert
                                }
                            }
                        }));
                    }
                    Object.assign(networkConfig, { organizations });

                    //fetch orderer orgs
                    let ordererOrgs = await DbService.findOrganizationByFilter({
                        consortium_id: consortium._id,
                        type: common.PEER_TYPE_ORDER,
                    });
                    if (ordererOrgs && ordererOrgs.length) {
                        let orderers = {};
                        for (let org of ordererOrgs) {
                            let _peers = await DbService.findPeersByFilter({
                                consortium_id: consortium._id,
                                org_id: org._id,
                                type: common.PEER_TYPE_ORDER,
                            });
                            _peers.map(peer => Object.assign(orderers, {
                                [`${peer.name}.${org.domain_name}`]: {
                                    url: `grpc://${peer.location}`,
                                    grpcOptions: {
                                        'ssl-target-name-override': `${peer.name}.${org.domain_name}`
                                    },
                                    tlsCACerts: {
                                        pem: peer.tls_cert
                                    }
                                }
                            }));
                        }
                        Object.assign(networkConfig, { orderers, peers });

                        //fetch all CAs
                        let cas = await DbService.findCaByFilter({
                            consortium_id: consortium._id,
                        });
                        if (cas && cas.length) {
                            let certificateAuthorities = {};
                            cas.map(ca => Object.assign(certificateAuthorities, {
                                [ca.name]: {
                                    url: ca.url,
                                    httpOptions: {
                                        verify: false
                                    },
                                    registrar: [
                                        {
                                            enrollId: ca.enroll_id,
                                            enrollSecret: ca.enroll_secret,
                                        }
                                    ],
                                    caName: ca.name,
                                }
                            }));
                            Object.assign(networkConfig, { certificateAuthorities }, {
                                channels: {
                                    [channel.name]: {
                                        orderers: Object.keys(orderers),
                                        peers: Object.keys(peers).map(peer => ({
                                            [peer]: {
                                                endorsingPeer: true,
                                                chaincodeQuery: true,
                                                ledgerQuery: true,
                                                eventSource: true,
                                            }
                                        })).reduce((acc, cur) => Object.assign(acc, cur), {}),
                                    }
                                }
                            }, {
                                client: {
                                    organization: Object.keys(organizations)[0]
                                }
                            });
                            ctx.body = common.success(networkConfig, common.SUCCESS);
                        } else {
                            ctx.status = 404;
                            ctx.body = common.error({}, 'Certificate authority not exist');
                        }
                    } else {
                        ctx.status = 404;
                        ctx.body = common.error({}, 'Orderer organization not exist');
                    }
                } else {
                    ctx.status = 404;
                    ctx.body = common.error({}, 'Peer organization not exist');
                }
            } else {
                ctx.status = 404;
                ctx.body = common.error({}, 'Channel not exist');
            }
        } else {
            ctx.status = 404;
            ctx.body = common.error({}, 'Consortium not exist');
        }
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/', async ctx => {
    try {
        let consortiums = await DbService.getConsortiums();
        consortiums = consortiums.map(consortium => {
            consortium = consortium.toJSON();
            consortium.network_config = '';
            return consortium;
        });
        ctx.body = common.success(consortiums, common.SUCCESS);
    } catch (err) {
        logger.error(err);
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.get('/:id', async ctx => {
    let res = Validator.JoiValidate('consortium', ctx.params, Schema.getConsortium);
    if (!res.result) throw new BadRequest(res.errMsg);

    let id = ctx.params.id;
    try {
        let consortium = await DbService.getConsortiumById(id);
        if (consortium) {
            let result = await consortiumService.getConsortiumInfo(id, consortium);
            ctx.body = common.success(result, 'success');
        } else {
            ctx.status = 404;
            ctx.body = common.error({}, 'Consortium not exist');
        }
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});

router.post('/', async ctx => {
    let res = Validator.JoiValidate('consortium', ctx.request.body, Schema.createConsortium);
    if (!res.result) throw new BadRequest(res.errMsg);

    try {
        let consortium = await DbService.addConsortium(ctx.request.body);
        ctx.body = common.success(consortium, common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/config', async ctx => {
    let res = Validator.JoiValidate('consortium', ctx.request.body, Schema.dynamicConfig);
    if (!res.result) throw new BadRequest(res.errMsg);

    try {
        let params = ctx.request.body;
        await DbService.findConsortiumAndUpdate(params.id, {
            normal_instance_limit: params.normalInstanceLimit,
            high_instance_limit: params.highInstanceLimit
        });
        ctx.body = common.success('The configuration changed dynamically successfully', common.SUCCESS);
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.get('/:id/:channel', config, async ctx => {
    try {
        let chainInfo = await QueryService.getBlockChainInfo(ctx.channel.name, ctx.peerConfig, ctx.caConfig);
        const blockNumber = chainInfo.height.low;
        let txNum = 0;
        for (let i = 0; i < blockNumber; i++) {
            let block = await QueryService.getBlockByFilter({
                queryBlockByNumber: true,
                blockNumber: i,
            }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
            txNum += utils.getTxNumber(block);
        }
        let chaincodes = await QueryService.getInstanceChaincodes(ctx.channel.name, ctx.peerConfig, ctx.caConfig);
        ctx.body = {
            peerNumber: ctx.channel.peers.length,
            blockNumber,
            transactionNumber: txNum,
            chaincodeNumber: chaincodes.chaincodes.length,
        };
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});
router.get('/:id/:channel/blocks', config, async ctx => {
    let limit = parseInt(ctx.query.limit) || 10;
    let sinceBlockNumber = parseInt(ctx.query.since_block_number);
    let res = Validator.JoiValidate('consortium', { limit }, Schema.getConsortiumBlocks);
    if (!res.result) throw new BadRequest(res.errMsg);

    try {
        let blocks = [];
        let paging = {};
        let cnt = 0;

        let chainInfo = await QueryService.getBlockChainInfo(ctx.channel.name, ctx.peerConfig, ctx.caConfig);
        const blockNumber = chainInfo.height.low;

        if (isNaN(sinceBlockNumber) || sinceBlockNumber < 0 || sinceBlockNumber > blockNumber - 1) {
            sinceBlockNumber = blockNumber - 1;
        }
        let endBlockNumber = Math.max(sinceBlockNumber - limit + 1, 0);

        for (let i = sinceBlockNumber; i >= endBlockNumber; i--) {
            let block = await QueryService.getBlockByFilter({
                queryBlockByNumber: true,
                blockNumber: i,
            }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
            let blockInfo = utils.decodeBlock(block);
            blocks.push({
                no: ++cnt,
                blockNumber: i,
                hash: blockInfo.hash,
                transactions: blockInfo.transactions,
                timestamp: blockInfo.timestamp
            });
        }
        if (sinceBlockNumber < blockNumber - 1) {
            let preBlockNumber = Math.min(sinceBlockNumber + limit, blockNumber - 1);
            Object.assign(paging, {
                previous: `${ctx.path}?limit=${limit}&since_block_number=${preBlockNumber}`
            });
        }
        if (endBlockNumber > 0) {
            let nextBlockNumber = Math.max(endBlockNumber - 1, 0);
            Object.assign(paging, {
                next: `${ctx.path}?limit=${limit}&since_block_number=${nextBlockNumber}`
            });
        }
        ctx.body = {
            blocks,
            limit,
            size: blocks.length,
            startBlockNumber: sinceBlockNumber,
            paging
        };
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});
router.get('/:id/:channel/transactions', config, async ctx => {
    let limit = parseInt(ctx.query.limit) || 10;
    let sinceBlockNumber = parseInt(ctx.query.since_block_number);
    let sinceTxIndex = parseInt(ctx.query.since_tx_index) || 0;
    let res = Validator.JoiValidate('consortium', { limit }, Schema.getConsortiumTransactions);
    if (!res.result) throw new BadRequest(res.errMsg);

    try {
        let transactions = [];
        let paging = {};
        let cnt = 0;

        let chainInfo = await QueryService.getBlockChainInfo(ctx.channel.name, ctx.peerConfig, ctx.caConfig);
        const blockNumber = chainInfo.height.low;

        if (isNaN(sinceBlockNumber) || sinceBlockNumber < 0 || sinceBlockNumber > blockNumber - 1) {
            sinceBlockNumber = blockNumber - 1;
        }
        let startBlockNumber = sinceBlockNumber;

        let block = await QueryService.getBlockByFilter({
            queryBlockByNumber: true,
            blockNumber: sinceBlockNumber,
        }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
        let tx = utils.getTxs(block);
        if (sinceTxIndex < 0 || sinceTxIndex > tx.length - 1) {
            sinceTxIndex = 0;
        }
        let txIdx = sinceTxIndex;

        while (transactions.length < limit && sinceBlockNumber >= 0) {
            block = await QueryService.getBlockByFilter({
                queryBlockByNumber: true,
                blockNumber: sinceBlockNumber,
            }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
            let txs = utils.getTxs(block);
            for (; txIdx < txs.length && transactions.length < limit; txIdx++) {
                transactions.push({
                    no: ++cnt,
                    txId: txs[txIdx].id,
                    timestamp: txs[txIdx].timestamp
                });
            }
            if (txIdx >= txs.length) {
                sinceBlockNumber--;
                txIdx = 0;
            }
        }
        if (startBlockNumber < blockNumber - 1) {
            let preRemainTxCount = limit - sinceTxIndex;
            if (preRemainTxCount <= 0) {
                Object.assign(paging, {
                    previous: `${ctx.path}?limit=${limit}&since_block_number=${startBlockNumber}`
                        + `&since_tx_index=${Math.abs(preRemainTxCount)}`
                });
            } else {
                let preBlockNumber = Math.min(startBlockNumber + 1, blockNumber - 1);
                block = await QueryService.getBlockByFilter({
                    queryBlockByNumber: true,
                    blockNumber: preBlockNumber,
                }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
                let preTx = utils.getTxs(block);
                let preTxCount = preTx.length;
                preRemainTxCount -= preTxCount;
                while (preRemainTxCount > 0) {
                    preBlockNumber = Math.min(preBlockNumber + 1, blockNumber - 1);
                    block = await QueryService.getBlockByFilter({
                        queryBlockByNumber: true,
                        blockNumber: preBlockNumber,
                    }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
                    preTx = utils.getTxs(block);
                    preTxCount = preTx.length;
                    preRemainTxCount -= preTxCount;
                }
                Object.assign(paging, {
                    previous: `${ctx.path}?limit=${limit}&since_block_number=${preBlockNumber}`
                        + `&since_tx_index=${Math.abs(preRemainTxCount)}`
                });
            }
        }
        if (sinceBlockNumber > 0) {
            Object.assign(paging, {
                next: `${ctx.path}?limit=${limit}&since_block_number=${sinceBlockNumber}`
                    + `&since_tx_index=${txIdx}`
            });
        }
        ctx.body = {
            transactions,
            limit,
            size: transactions.length,
            startBlockNumber,
            paging
        };
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error([], err.message);
    }
});
router.get('/:id/:channel/block/:blockNumber', config, async ctx => {
    let blockNumber = parseInt(ctx.params.blockNumber);
    let res = Validator.JoiValidate('consortium', { blockNumber }, Schema.getConsortiumBlock);
    if (!res.result) throw new BadRequest(res.errMsg);

    let block = await QueryService.getBlockByFilter({
        queryBlockByNumber: true,
        blockNumber,
    }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
    ctx.body = utils.inspectBlock(block);
});
router.get('/:id/:channel/transaction/:hash', config, async ctx => {
    const { hash } = ctx.params;
    let transaction = await QueryService.getTransaction(hash, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
    ctx.body = utils.decodeTransaction(transaction);
});
router.get('/:id/:channel/search', config, async ctx => {
    let res = Validator.JoiValidate('consortium', ctx.query, Schema.consortiumSearch);
    if (!res.result) throw new BadRequest(res.errMsg);

    let { q } = ctx.query;
    let block;
    if (!isNaN(q)) {
        block = await QueryService.getBlockByFilter({
            queryBlockByNumber: true,
            blockNumber: parseInt(q),
        }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
    } else {
        block = await QueryService.getBlockByFilter({
            queryBlockByTxID: true,
            txId: q,
        }, ctx.channel.name, ctx.peerConfig, ctx.caConfig);
    }
    ctx.body = utils.inspectBlock(block);
});
module.exports = router;
