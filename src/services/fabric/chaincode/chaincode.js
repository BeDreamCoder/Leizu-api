/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const DbService = require('../../db/dao');
const common = require('../../../libraries/common');
const installChaincode = require('./install-chaincode');
const instantiateChaincode = require('./instantiate-chaincode');
const upgradeChaincode = require('./upgrade-chaincode');
const invokeChaincode = require('./invoke-chaincode');
const queryChaincode = require('./query-chaincode');

module.exports = class ChaincodeService {
    constructor(chaincodeId, peers) {
        this._consortiumId = '';
        this._chaincodeId = chaincodeId;
        this._chaincodeName = '';
        this._chaincodeVersion = '';
        this._chaincodePath = '';
        this._chaincodeState = null;
        this._peers = peers;
        this._peersInfo = null;
    }

    static async getInstance(id, peers) {
        try {
            let chaincodeService = new ChaincodeService(id, peers);
            await chaincodeService.init();
            return chaincodeService;
        } catch (err) {
            throw err;
        }
    }

    async init() {
        try {
            let cc = await DbService.findChaincodeById(this._chaincodeId);
            if (!cc) {
                throw new Error('The chaincode does not exist: ' + this._chaincodeId);
            }
            if (!this._peers && !cc.peers) {
                throw new Error('No peers was found.');
            }
            await this.getPeersInfo(this._peers ? this._peers : cc.peers);
            if (this._peers && cc.peers) {
                if (this._peers.some(id => {
                    return cc.peers.indexOf(id) !== -1;
                })) {
                    throw new Error('Exist installed peers.');
                }
                this._peers = this._peers.concat(cc.peers);
            } else {
                this._peers = cc.peers;
            }
            this._consortiumId = cc.consortium_id;
            this._chaincodeName = cc.name;
            this._chaincodeVersion = cc.version;
            this._chaincodePath = cc.path;
            this._chaincodeState = cc.state;
        } catch (err) {
            throw err;
        }
    }

    async getPeersInfo(peers) {
        try {
            let peersInfo = {};
            for (let id of peers) {
                let peer = await DbService.findPeerById(id);
                if (!peer) throw new Error('The peer does not exist: ' + id);
                if (!peersInfo[peer.org_id]) peersInfo[peer.org_id] = [];
                peersInfo[peer.org_id].push(id);
            }
            this._peersInfo = peersInfo;
        } catch (err) {
            throw err;
        }
    }

    /*Roles allowed in the endorsement policy to be checked by VSCC:
     i. peer
     ii. client
     iii. member
     iv. admin
    {
        "identities": [
            { "role": { "name": "member", "mspId": "Org1MSP" }},
            { "role": { "name": "member", "mspId": "Org2MSP" }}
            ],
        "policy": {
            "1-of": [{ "signed-by": 0 }, { "signed-by": 1 }]
        }
    }*/
    static async buildEndorsementPolicy(orgIds) {
        if (!orgIds || orgIds.length === 0) {
            throw new Error('No organization was found');
        }
        let endorsementPolicy = {identities: [], policy: {}};
        for (let orgId of orgIds) {
            let organization = await DbService.findOrganizationById(orgId);
            if (!organization) {
                throw new Error('The organization does not exist: ' + orgId);
            }
            endorsementPolicy.identities.push({role: {name: 'member', mspId: organization.msp_id}});
        }
        let signRoles = [];
        for (let i in endorsementPolicy.identities) {
            signRoles.push({'signed-by': parseInt(i)});
        }
        let signNum = Math.ceil(endorsementPolicy.identities.length / 2);
        endorsementPolicy.policy[`${signNum}-of`] = signRoles;
        return endorsementPolicy;
    }

    static async uploadChaincode(params) {
        let {consortiumId, chaincodeName, chaincodeVersion, chaincodeDesc, chaincodeType, chaincodePath} = params;
        let consortium = await DbService.getConsortiumById(consortiumId);
        if (!consortium) {
            throw  new Error('Invalid consortium id.');
        }
        chaincodeType = chaincodeType ? chaincodeType : common.CHAINCODE_TYPE_GOLANG;
        try {
            let cc = await DbService.addChaincode({
                consortiumId: consortiumId,
                name: chaincodeName,
                version: chaincodeVersion,
                desc: chaincodeDesc,
                path: chaincodePath,
                type: chaincodeType
            });
            return cc;
        } catch (err) {
            throw err;
        }
    }

    async installChaincode(peerName) {
        try {
            let results = [];
            for (let orgId in this._peersInfo) {
                let organization = await DbService.findOrganizationById(orgId);
                if (!organization) {
                    throw new Error('The organization does not exist: ' + orgId);
                }
                let responses = await installChaincode.installChaincode(this._peersInfo[orgId], this._chaincodeName, this._chaincodePath,
                    this._chaincodeVersion, common.CHAINCODE_TYPE_GOLANG, organization);
                await DbService.addChaincodeRecord({
                    consortiumId: this._consortiumId,
                    chaincodeId: this._chaincodeId,
                    opt: common.CHAINCODE_STATE_INSTALLED,
                    target: peerName,
                    msg: responses[0]
                });
                results = results.concat(responses);
            }
            await DbService.findChaincodeAndUpdate(this._chaincodeId, {
                peers: this._peers, status: common.CHAINCODE_STATE_INSTALLED
            });
            return results;
        } catch (err) {
            await DbService.findChaincodeAndUpdate(this._chaincodeId, {
                status: common.CHAINCODE_STATE_INSTALL_FAILED
            });
            await DbService.addChaincodeRecord({
                consortiumId: this._consortiumId,
                chaincodeId: this._chaincodeId,
                opt: common.CHAINCODE_STATE_INSTALL_FAILED,
                target: peerName,
                msg: err.message
            });
            throw err;
        }
    }

    async instantiateAndUpgradeChaincode(channelId, functionName, args, opt, policyType) {
        let channel;
        try {
            if (policyType !== common.POLICY_MAJORITY) {
                throw new Error('Endorsement policy is invalid.');
            }
            channel = await DbService.getChannelById(channelId);
            if (!channel) {
                throw new Error('The channel does not exist: ' + channelId);
            }
            if (this._peers.every(id => {
                return channel.peers.indexOf(id) === -1;
            })) {
                throw new Error('The chaincode is not yet installed in the channel.');
            }
            let endorsementPolicy = await ChaincodeService.buildEndorsementPolicy(channel.orgs);

            if (!channel.orgs || channel.orgs.length === 0) {
                throw new Error('No organization was found on the channel');
            }
            let orgIds = Object.getOwnPropertyNames(this._peersInfo);
            if (!orgIds || orgIds.length === 0) {
                throw new Error('No organization was found');
            }

            let chaincodeState;
            let result;
            let errMsg = [];
            let bSucceed = false;
            for (let id of orgIds) {
                if (channel.orgs.indexOf(String(id)) !== -1) {
                    try {
                        let organization = await DbService.findOrganizationById(id);
                        if (!organization) {
                            throw new Error('The organization does not exist: ' + id);
                        }
                        let targets = [this._peersInfo[id][0]];
                        if (opt === 'instantiate') {
                            result = await instantiateChaincode.instantiateChaincode(targets, channel.name, this._chaincodeName,
                                this._chaincodeVersion, functionName, common.CHAINCODE_TYPE_GOLANG, args, organization, endorsementPolicy);
                            chaincodeState = common.CHAINCODE_STATE_DEPLOYED;
                        } else if (opt === 'upgrade') {
                            result = await upgradeChaincode.upgradeChaincode(targets, channel.name, this._chaincodeName,
                                this._chaincodeVersion, functionName, common.CHAINCODE_TYPE_GOLANG, args, organization, endorsementPolicy);
                            chaincodeState = common.CHAINCODE_STATE_UPGRADED;
                        }
                        bSucceed = true;
                        break;
                    } catch (e) {
                        errMsg.push(e.message);
                    }
                }
            }
            if (bSucceed === false) throw new Error(JSON.stringify(errMsg));

            let state = this._chaincodeState ? this._chaincodeState : {};
            state[channelId] = chaincodeState;
            await DbService.addChaincodeRecord({
                consortiumId: this._consortiumId,
                chaincodeId: this._chaincodeId,
                opt: chaincodeState,
                target: channel.name,
                msg: result
            });
            await DbService.findChaincodeAndUpdate(this._chaincodeId, {
                state: state,
                status: chaincodeState
            });
            return {
                success: true,
                target: channel.name,
                data: result
            };
        } catch (err) {
            let channelName = channel ? channel.name : channelId;
            let status = opt === 'instantiate' ? common.CHAINCODE_STATE_DEPLOY_FAILED : common.CHAINCODE_STATE_UPGRADE_FAILED;
            await DbService.findChaincodeAndUpdate(this._chaincodeId, {
                status: status
            });
            await DbService.addChaincodeRecord({
                consortiumId: this._consortiumId,
                chaincodeId: this._chaincodeId,
                opt: status,
                target: channelName,
                msg: err.message
            });
            return {
                success: false,
                target: channelName,
                error: err
            };
        }
    }

    async invokeChaincode(channelId, functionName, args) {
        try {
            let channel = await DbService.getChannelById(channelId);
            if (!channel) {
                throw new Error('The channel does not exist: ' + channelId);
            }
            if (!channel.orgs || channel.orgs.length === 0) {
                throw new Error('No organization was found on the channel');
            }
            let orgIds = Object.getOwnPropertyNames(this._peersInfo);
            if (!orgIds || orgIds.length === 0) {
                throw new Error('No organization was found');
            }
            let orgId;
            for (let id of orgIds) {
                if (channel.orgs.indexOf(String(id)) !== -1) {
                    orgId = id;
                    break;
                }
            }
            let organization = await DbService.findOrganizationById(orgId);
            if (!organization) {
                throw new Error('The organization does not exist: ' + orgId);
            }
            let endorsePeer = [];
            for (let id of orgIds) {
                if (channel.orgs.indexOf(String(id)) !== -1 && this._peersInfo[id].length > 0) {
                    endorsePeer.push(this._peersInfo[id][0]);
                }
            }
            return invokeChaincode.invokeChaincode(endorsePeer, organization, channel.name, this._chaincodeName, functionName, args);
        } catch (err) {
            throw err;
        }
    }

    async queryChaincode(channelId, functionName, args) {
        try {
            let channel = await DbService.getChannelById(channelId);
            if (!channel) {
                throw new Error('The channel does not exist: ' + channelId);
            }
            if (!channel.orgs || channel.orgs.length === 0) {
                throw new Error('No organization was found on the channel');
            }
            let orgIds = Object.getOwnPropertyNames(this._peersInfo);
            if (!orgIds || orgIds.length === 0) {
                throw new Error('No organization was found');
            }
            let orgId;
            for (let id of orgIds) {
                if (channel.orgs.indexOf(String(id)) !== -1) {
                    orgId = id;
                    break;
                }
            }
            let organization = await DbService.findOrganizationById(orgId);
            if (!organization) {
                throw new Error('The organization does not exist: ' + orgId);
            }
            let endorsePeer = [];
            for (let id of orgIds) {
                if (channel.orgs.indexOf(String(id)) !== -1 && this._peersInfo[id].length > 0) {
                    endorsePeer.push(this._peersInfo[id][0]);
                }
            }
            return queryChaincode.queryChaincode(endorsePeer, organization, channel.name, this._chaincodeName, functionName, args);
        } catch (err) {
            throw err;
        }
    }
};