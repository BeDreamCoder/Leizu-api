/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const uuid = require('uuid/v1');
const Channel = require('../../models/channel');
const Organization = require('../../models/organization');
const Peer = require('../../models/peer');
const Consortium = require('../../models/consortium');
const CertAuthority = require('../../models/certauthority');
const Chaincode = require('../../models/chaincode');
const ChaincodeRecord = require('../../models/chaincode-record');
const AliCloud = require('../../models/alicloud');
const Common = require('../../libraries/common');

module.exports = class DbService {

    static async getChannels() {
        let channels = await Channel.find();
        return channels;
    }

    static async getChannelsByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let channels = await Channel.find(filter);
        return channels;
    }

    static async getChannelsByCondition(where) {
        let channels = await Channel.find(where);
        return channels;
    }

    static async getChannelByName(channelName) {
        let channel = await Channel.findOne({name: channelName});
        return channel;
    }

    static async getChannelById(id) {
        let channel = await Channel.findById(id);
        return channel;
    }

    static async getChannelByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let channel = await Channel.findOne(filter);
        return channel;
    }

    static async countChannelByConsortiumId(consortiumId) {
        let count = await Channel.count({consortium_id: consortiumId});
        return count;
    }

    static async getConsortiums() {
        let consortiums = await Consortium.find();
        return consortiums;
    }

    static async getConsortiumById(id) {
        let consortium = await Consortium.findById(id);
        return consortium;
    }

    static async addConsortium(dto) {
        let consortium = new Consortium();
        consortium.name = dto.name;
        consortium.uuid = uuid();
        consortium.network_config = JSON.stringify(dto);
        consortium = await consortium.save();
        return consortium;
    }

    static async findConsortiumAndUpdate(id, update) {
        let consortium = await Consortium.findByIdAndUpdate(id, update);
        return consortium;
    }

    static async findPeers() {
        let peers = await Peer.find();
        return peers;
    }

    static async findPeerById(id) {
        let peer = await Peer.findById(id);
        return peer;
    }

    static async findPeerByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let peer = await Peer.findOne(filter);
        return peer;
    }

    static async findPeersByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let peers = await Peer.find(filter);
        return peers;
    }

    static async findOrdererById(id) {
        let orderer = await Peer.findOne({_id: id, type: Common.PEER_TYPE_ORDER});
        return orderer;
    }

    static async findOrderes() {
        let orderers = await Peer.find({type: Common.PEER_TYPE_ORDER});
        return orderers;
    }

    static async findPeersByOrgId(orgId, type) {
        let condition = {org_id: orgId};
        if (type === 0 || type === 1) {
            condition.type = type;
        }
        return await Peer.find(condition);
    }

    static async findPeersByConsortiumId(consortiumId, type) {
        let condition = {consortium_id: consortiumId};
        if (type === 0 || type === 1) {
            condition.type = type;
        }
        return await Peer.find(condition);
    }

    static async addPeer(dto) {
        let peer = new Peer();
        peer.uuid = uuid();
        peer.name = dto.name;
        peer.location = dto.location;
        peer.org_id = dto.organizationId;
        peer.consortium_id = dto.consortiumId;
        peer.sign_key = dto.adminKey;
        peer.sign_cert = dto.signcerts;
        peer.tls_key = dto.tls.key;
        peer.tls_cert = dto.tls.cert;
        peer = await peer.save();
        return peer;
    }

    static async countPeersByConsortiumId(consortiumId) {
        let count = await Peer.countDocuments({consortium_id: consortiumId});
        return count;
    }

    static async countPeersByOrg(orgId) {
        let data = await Peer.aggregate([
            {$match: {'org_id': {$in: orgId}}},
            {
                $group: {
                    _id: '$org_id',
                    total: {$sum: 1}
                }
            }
        ]);
        return data;
    }

    static async addOrderer(dto) {
        let peer = new Peer();
        peer.uuid = uuid();
        peer.name = dto.name;
        peer.location = dto.location;
        peer.org_id = dto.organizationId;
        peer.type = Common.PEER_TYPE_ORDER;
        peer.consortium_id = dto.consortiumId;
        peer.sign_key = dto.adminKey;
        peer.sign_cert = dto.signcerts;
        peer.tls_key = dto.tls.key;
        peer.tls_cert = dto.tls.cert;
        peer = await peer.save();
        return peer;
    }

    static async findOrganizations() {
        let organizations = await Organization.find();
        return organizations;
    }

    static async getOrganizationsByIds(orgIds) {
        let where = {};
        if (orgIds && orgIds.length > 0) {
            where = {_id: orgIds};
        }
        let organizations = await Organization.find(where);
        return organizations;
    }

    static async getOrganizationsByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let organizations = await Organization.find(filter);
        return organizations;
    }

    static async countOrgsByConsortiumId(consortiumId) {
        let count = await Organization.countDocuments({consortium_id: consortiumId});
        return count;
    }

    static async findOrganizationById(id) {
        let organization = await Organization.findById(id);
        return organization;
    }

    static async findOrganizationByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let organization = await Organization.find(filter);
        return organization;
    }

    static async addOrganization(dto) {
        let organization = new Organization();
        organization.uuid = uuid();
        organization.name = dto.orgName;
        organization.domain_name = dto.domainName;
        organization.msp_id = dto.mspId;
        organization.admin_key = dto.adminKey;
        organization.admin_cert = dto.adminCert;
        organization.root_cert = dto.rootCert;
        organization.msp_path = dto.mspPath;
        organization.consortium_id = dto.consortiumId;
        organization.type = dto.type;
        organization = await organization.save();
        return organization;
    }

    static async findOrganizationAndUpdate(id, update) {
        if (!update) {
            update = {};
        }
        let org = await Organization.findByIdAndUpdate(id, update);
        return org;
    }

    static async addCertAuthority(dto) {
        let certAuthority = new CertAuthority();
        certAuthority.uuid = uuid();
        certAuthority.name = dto.name;
        certAuthority.url = dto.url;
        certAuthority.org_id = dto.orgId;
        certAuthority.consortium_id = dto.consortiumId;
        certAuthority.enroll_id = dto.enrollId || Common.BOOTSTRAPUSER.enrollmentID;
        certAuthority.enroll_secret = dto.enrollSecret || Common.BOOTSTRAPUSER.enrollmentSecret;
        certAuthority = certAuthority.save();
        return certAuthority;
    }

    static async findCertAuthorityByOrg(orgId) {
        return await CertAuthority.findOne({org_id: orgId});
    }

    static async findOrdererByConsortium(consortiumId) {
        let orderer = await Peer.findOne({consortium_id: consortiumId, type: Common.PEER_TYPE_ORDER});
        if (!orderer) {
            throw new Error('can not found any orderer for consortium: ' + consortiumId);
        }
        return orderer;
    }

    static async getCaByOrgId(orgId) {
        let ca = await CertAuthority.findOne({org_id: orgId});
        if (!ca) {
            throw new Error('can not found ca server for ' + orgId);
        }
        return {
            url: ca.url,
            name: ca.name,
            enrollId: ca.enroll_id,
            enrollSecret: ca.enroll_secret
        };
    }

    static async findCaByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let ca = await CertAuthority.find(filter);
        return ca;
    }

    static async findOrganizationByName(consortiumId, name) {
        try {
            let organization = await Organization.findOne({consortium_id: consortiumId, name: name});
            return organization;
        } catch (err) {
            return null;
        }
    }

    static async addChaincode(dto) {
        let cc = new Chaincode();
        cc.uuid = uuid();
        cc.consortium_id = dto.consortiumId;
        cc.name = dto.name;
        cc.path = dto.path;
        cc.version = dto.version;
        cc.desc = dto.desc;
        cc.type = dto.type;
        cc.peers = dto.peers;
        cc.status = dto.status;
        cc.state = dto.state;
        cc = await cc.save();
        return cc;
    }

    static async getChaincodeByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let cc = await Chaincode.find(filter);
        return cc;
    }

    static async findChaincodeById(id) {
        let cc = await Chaincode.findById(id);
        return cc;
    }

    static async findChaincodes(where) {
        let query = {state: 1};
        let cc = await Chaincode.find(where, query);
        return cc;
    }

    static async findChaincodeAndUpdate(id, update) {
        let cc = await Chaincode.findByIdAndUpdate(id, update);
        return cc;
    }

    static async addChaincodeRecord(dto) {
        let ccRecord = new ChaincodeRecord();
        ccRecord.uuid = uuid();
        ccRecord.consortium_id = dto.consortiumId;
        ccRecord.chaincode_id = dto.chaincodeId;
        ccRecord.opt = dto.opt;
        ccRecord.target = dto.target;
        ccRecord.message = dto.msg;
        ccRecord = await ccRecord.save();
        return ccRecord;
    }

    static async getChaincodeRecordByFilter(filter) {
        if (!filter) {
            filter = {};
        }
        let record = await ChaincodeRecord.find(filter);
        return record;
    }

    static async addAliCloud(dto) {
        let alicloud = new AliCloud();
        alicloud.uuid = uuid();
        alicloud.instance = dto.instance;
        alicloud.instance_type = dto.instanceType;
        alicloud.vpc = dto.vpc;
        alicloud.region = dto.region;
        alicloud.zone = dto.zone;
        alicloud.vswitch = dto.vswitch;
        alicloud.security_group = dto.securityGroup;
        alicloud.public_ip_address = dto.publicIpAddress;
        alicloud.consortium_id = dto.consortiumId;
        alicloud.creation_time = dto.creationTime;
        alicloud = await alicloud.save();
        return alicloud;
    }

    static async findOneAliCloud(consortiumId) {
        let alicloud = await AliCloud.findOne({consortium_id: consortiumId});
        return alicloud;
    }

    static async findInstances(consortiumId, instanceType) {
        let aliclouds = await AliCloud.find({consortium_id: consortiumId, instance_type: instanceType});
        return aliclouds;
    }

    static async delAlicloudRecord(id) {
        await AliCloud.deleteOne({_id: id});
    }
};
