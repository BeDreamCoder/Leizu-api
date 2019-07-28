/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cryptoConfig = require('../../../env').cryptoConfig;
const common = require('../../../libraries/common');
const utils = require('../../../libraries/utils');

const batch_default = {
    BatchTimeout: '2s',
    BatchSize: {
        MaxMessageCount: 10,
        AbsoluteMaxBytes: '99 MB',
        PreferredMaxBytes: '512 KB'
    }
};

const raft_options = {
    TickInterval: '500ms',
    ElectionTick: 10,
    HeartbeatTick: 1,
    MaxInflightBlocks: 5,
    SnapshotIntervalSize: '20 MB',
};

module.exports = class ConfigTxBuilder {
    constructor(options) {
        this._options = options;
        this._filePath = path.join(cryptoConfig.path, options.ConsortiumId);
    }

    //build information of organization
    _buildOrganization(org) {
        let obj = {
            Name: org.Name,
            ID: org.MspId,
            MSPDir: this._getMspPath(org.Name)
        };
        if (org.Type === common.PEER_TYPE_PEER && org.AnchorPeers && org.AnchorPeers.length > 0) {
            obj.AnchorPeers = org.AnchorPeers;
        }
        return obj;
    }

    _getMspPath(orgName) {
        return path.join('data', this._options.ConsortiumId, orgName, 'msp');
    }

    _getOrdererTlsPath(ordererName) {
        return path.join('data', this._options.ConsortiumId, this._options.Orderer.OrderOrg, 'peers', ordererName, 'tls/server.crt',);
    }

    //build orderer's information
    _buildOrderer() {
        let obj = {
            OrdererType: this._options.Orderer.OrdererType,
            Addresses: this._options.Orderer.Addresses
        };
        if (obj.OrdererType === common.CONSENSUS_KAFKA) {
            if (this._options.Orderer.Kafka) {
                obj.Kafka = this._options.Orderer.Kafka;
            } else {
                throw new Error('configtxgen not found kafka info');
            }
        }
        if (obj.OrdererType === common.CONSENSUS_RAFT) {
            if (this._options.Orderer.EtcdRaft) {
                let consenters = [];
                for (let consenter of this._options.Orderer.EtcdRaft.consenters) {
                    consenters.push({
                        Host: consenter.host,
                        Port: consenter.port,
                        ClientTLSCert: this._getOrdererTlsPath(consenter.name),
                        ServerTLSCert: this._getOrdererTlsPath(consenter.name)
                    });
                }
                obj.EtcdRaft = {Consenters: consenters, Options: raft_options};
            } else {
                throw new Error('configtxgen not found etcd raft info');
            }
        }
        if (this._options.Orderer.BatchTimeout) {
            obj.BatchTimeout = this._options.Orderer.BatchTimeout;
        } else {
            obj.BatchTimeout = batch_default.BatchTimeout;
        }
        if (this._options.Orderer.BatchSize) {
            obj.BatchSize = this._options.Orderer.BatchSize;
        } else {
            obj.BatchSize = batch_default.BatchSize;
        }
        obj.Organizations = [];
        for (let org of this._options.Organizations) {
            if (org.Type === common.PEER_TYPE_ORDER) {
                obj.Organizations.push(this._buildOrganization(org));
            }
        }
        obj.Capabilities = {V1_1: true};
        return obj;
    }

    _buildConsortiums() {
        let obj = {};
        let orgs = [];
        for (let org of this._options.Organizations) {
            if (org.Type === common.PEER_TYPE_PEER) {
                orgs.push(this._buildOrganization(org));
            }
        }
        obj[this._options.Consortium] = {Organizations: orgs};
        return obj;
    }

    _buildApplication() {
        let orgs = [];
        for (let org of this._options.Organizations) {
            if (org.Type === common.PEER_TYPE_PEER) {
                orgs.push(this._buildOrganization(org));
            }
        }
        return {Organizations: orgs, Capabilities: {V1_2: true}};
    }

    //for add new org
    buildPrintOrg() {
        let orgs = [];
        for (let org of this._options.Organizations) {
            if (org.Type === common.PEER_TYPE_PEER) {
                orgs.push(this._buildOrganization(org));
            }
        }
        let configtx = {Organizations: orgs};
        let yamlData = yaml.safeDump(configtx);
        return yamlData;
    }

    //for create channel
    buildChannelCreateTx() {
        let configtx = {Profiles: {}};
        configtx.Profiles[common.CONFIFTX_OUTPUT_CHANNEL] = {
            Consortium: this._options.Consortium,
            Application: this._buildApplication()
        };
        let yamlData = yaml.safeDump(configtx);
        return yamlData;
    }

    //build configtx.yaml file for genesis block
    buildConfigtxYaml() {
        let configtx = {Profiles: {}};
        configtx.Profiles[common.CONFIFTX_OUTPUT_GENESIS_BLOCK] = {
            Capabilities: {V1_1: true},
            Orderer: this._buildOrderer(),
            Consortiums: this._buildConsortiums()
        };

        configtx.Profiles[common.CONFIFTX_OUTPUT_CHANNEL] = {
            Consortium: this._options.Consortium,
            Application: this._buildApplication()
        };
        let yamlData = yaml.safeDump(configtx);
        utils.createDir(this._filePath);
        let configTxPath = path.join(this._filePath, cryptoConfig.name);
        fs.writeFileSync(configTxPath, yamlData);
        return yamlData;
    }
};