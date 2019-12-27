/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const DbService = require('../../db/dao');
const CreateChannel = require('./create-channel');
const JoinChannel = require('./join-channel');
const UpdateChannel = require('./update-channel');
const common = require('../../../libraries/common');

module.exports = class ChannelService {
    constructor(organizationId, channelName) {
        this._organization_id = organizationId;
        this._organization = null;
        this._channel_name = channelName;
        this._consortium_id = '';
        this._consortium_name = '';
        this._fabric_version = '';
    }

    static async getInstance(organizationId, channelId) {
        try {
            let channelService = new ChannelService(organizationId, channelId);
            await channelService.init();
            return channelService;
        } catch (e) {
            throw e;
        }
    }

    async init() {
        try {
            let organization = await DbService.findOrganizationById(this._organization_id);
            if (!organization) {
                throw new Error('The organization does not exist: ' + this._organization_id);
            }
            this._organization = organization;
            let consortium = await DbService.getConsortiumById(organization.consortium_id);
            if (consortium) {
                // this._network_config = JSON.parse(consortium.network_config);
                this._consortium_id = organization.consortium_id.toString();
                this._consortium_name = consortium.name;
                this._fabric_version = consortium.version;
            } else {
                throw new Error('The consortium does not exist.');
            }
        } catch (e) {
            throw e;
        }
    }

    async getOrgAnchorPeers(organizationId) {
        try {
            let peer = await DbService.findPeersByOrgId(organizationId, common.PEER_TYPE_PEER);
            let anchorPeers = [];
            if (peer) {
                peer.map(item => {
                    let flag = item.location.indexOf(common.SEPARATOR_COLON);
                    let host = item.location.slice(0, flag);
                    let port = item.location.slice(flag + common.SEPARATOR_COLON.length);
                    anchorPeers.push({Host: host, Port: port});
                });
            }
            return anchorPeers;
        } catch (e) {
            throw e;
        }
    }

    async buildOrganization(organizationId) {
        let organization = await DbService.findOrganizationById(organizationId);
        if (!organization) {
            throw new Error('The organization does not exist: ' + organizationId);
        }
        if (organization.type !== common.PEER_TYPE_PEER) {
            throw new Error('The organization type can not orderer');
        }
        return {
            Name: organization.name,
            MspId: organization.msp_id,
            Type: common.PEER_TYPE_PEER,
            AnchorPeers: await this.getOrgAnchorPeers(organizationId)
        };
    }

    async createChannel(orgIds) {
        let organizations = [];
        for (let organizationId of orgIds) {
            let org = await this.buildOrganization(organizationId);
            if (org.AnchorPeers && org.AnchorPeers.length > 0) {
                organizations.push(org);
            } else {
                throw new Error('Not found anchor peers in the organization:' + org.Name);
            }
        }
        let channelCreateTx = {
            Consortium: this._consortium_name,
            ConsortiumId: this._consortium_id,
            Organizations: organizations,
            Version: this._fabric_version,
            Admin: this._organization.msp_id,
        };
        return CreateChannel.createChannel(channelCreateTx, this._channel_name, this._organization);
    }

    joinChannel(peers) {
        return JoinChannel.joinChannel(this._channel_name, this._organization, peers);
    }

    async updateAppChannel(channelId) {
        let organizations = await this.buildOrganization(this._organization_id);
        return UpdateChannel.updateAppChannel(channelId, {
            ConsortiumId: this._consortium_id,
            Organizations: [organizations]
        });
    }

    async updateSysChannel() {
        return UpdateChannel.updateSysChannel({
            ConsortiumId: this._consortium_id,
            Organizations: [{
                Name: this._organization.name,
                MspId: this._organization.msp_id,
                Type: common.PEER_TYPE_PEER,
                AnchorPeers: await this.getOrgAnchorPeers(this._organization_id)
            }]
        });
    }
};
