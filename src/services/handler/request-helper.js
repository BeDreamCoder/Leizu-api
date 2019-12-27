/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const utils = require('../../libraries/utils');
const stringUtil = require('../../libraries/string-util');
const common = require('../../libraries/common');
const AliCloud = require('../provider/common').AliCloud;
const images = require('../../images');

module.exports = class RequestHelper {

    static decomposeRequest(request) {
        let configuration = utils.extend({}, request);
        configuration.orderer = RequestHelper.getOrderer(configuration);
        configuration.peers = RequestHelper.getPeers(configuration);
        configuration.consuls = RequestHelper.getConsuls(configuration);
        configuration.isKafkaConsensus = RequestHelper.isKafkaConsensus(configuration);
        if (configuration.isKafkaConsensus) {
            configuration.kafkaCluster = RequestHelper.getKafkaCluster(configuration);
        }
        configuration.ordererImage = images.fabric[configuration.version].orderer;
        configuration.peerImage = images.fabric[configuration.version].peer;
        return configuration;
    }

    static getOrderer(configuration) {
        let orderer = {};
        if (configuration.ordererOrg) {
            let ordererOrg = configuration.ordererOrg;
            orderer.orgName = ordererOrg.name;
            orderer.type = common.PEER_TYPE_ORDER;
            orderer.caName = ordererOrg.ca.name;
            orderer.caNode = {
                host: ordererOrg.ca.ip,
                username: ordererOrg.ca.ssh_username,
                password: ordererOrg.ca.ssh_password
            };
            orderer.nodes = [];
            if (ordererOrg.orderer) {
                for (let item of ordererOrg.orderer) {
                    orderer.nodes.push({
                        name: item.name,
                        host: item.ip,
                        username: item.ssh_username,
                        password: item.ssh_password
                    });
                }
            }
        }
        return orderer;
    }

    static getPeers(configuration) {
        let peers = [];
        if (configuration.peerOrgs) {
            for (let item of configuration.peerOrgs) {
                let peer = {};
                peer.orgName = item.name;
                peer.type = common.PEER_TYPE_PEER;
                peer.caName = item.ca.name;
                peer.caNode = {
                    host: item.ca.ip,
                    username: item.ca.ssh_username,
                    password: item.ca.ssh_password
                };
                peer.nodes = [];
                for (let element of item.peers) {
                    peer.nodes.push({
                        orgName: item.name,
                        name: element.name,
                        host: element.ip,
                        username: element.ssh_username,
                        password: element.ssh_password
                    });
                }
                peers.push(peer);
            }
        }
        return peers;
    }

    static getConsuls(configuration) {
        let consuls = [];
        if (configuration.peerOrgs) {
            for (let item of configuration.peerOrgs) {
                item.peers.map((element) => {
                    consuls.push({
                        host: element.ip,
                        username: element.ssh_username,
                        password: element.ssh_password
                    });
                });
            }
        }
        if (configuration.ordererOrg.orderer) {
            configuration.ordererOrg.orderer.map((item) => {
                consuls.push({
                    host: item.ip,
                    username: item.ssh_username,
                    password: item.ssh_password
                });
            });
        }
        return consuls;
    }

    static getKafkaCluster(configuration) {
        let cluster = {};
        let zks = [];
        for (let zk of configuration.zookeeper) {
            zks.push({
                name: zk.name,
                host: zk.ip,
                username: zk.ssh_username,
                password: zk.ssh_password
            });
        }
        let kfs = [];
        for (let kf of configuration.kafka) {
            kfs.push({
                name: kf.name,
                host: kf.ip,
                username: kf.ssh_username,
                password: kf.ssh_password
            });
        }
        cluster.zookeepers = zks;
        cluster.kafkas = kfs;
        return cluster;
    }

    static isKafkaConsensus(configuration) {
        if (configuration.consensus == common.CONSENSUS_KAFKA) {
            return true;
        } else {
            return false;
        }
    }

    static countEcsInstances(request) {
        let instances = {normal: 0, high: 0};
        let counter = (type) => {
            if (type === common.CLOUD_INSTANCE_TYPE_NORMAL) {
                instances.normal++;
            } else if (type === common.CLOUD_INSTANCE_TYPE_HIGH) {
                instances.high++;
            }
        };

        if (request.ordererOrg) {
            let ordererOrg = request.ordererOrg;
            if (ordererOrg.ca) {
                counter(ordererOrg.ca.type);
            }
            if (ordererOrg.orderer && ordererOrg.orderer.length > 0) {
                for (let v of ordererOrg.orderer) {
                    counter(v.type);
                }
            }
        }
        if (request.peerOrgs && request.peerOrgs.length > 0) {
            for (let item of request.peerOrgs) {
                if (item.ca) {
                    counter(item.ca.type);
                }
                if (item.peers && item.peers.length > 0) {
                    for (let v of item.peers) {
                        counter(v.type);
                    }
                }
            }
        }
        if (request.consensus === common.CONSENSUS_KAFKA) {
            if (request.kafka && request.kafka.length > 0) {
                for (let v of request.kafka) {
                    counter(v.type);
                }
            }
            if (request.zookeeper && request.zookeeper.length > 0) {
                for (let v of request.zookeeper) {
                    counter(v.type);
                }
            }
        }

        return instances;
    }

    static convertToSSHRequest(request, instances, amount) {
        let index = {
            normal: 0,
            high: -1,
        };
        if (amount.normal > 0 && amount.high > 0) {
            index.high = 1;
        } else if (amount.high > 0) {
            index.high = 0;
        }
        let convert = (name, type) => {
            if (type === common.CLOUD_INSTANCE_TYPE_NORMAL) {
                if (instances[index.normal] && instances[index.normal].length > 0) {
                    let item = instances[index.normal].pop();
                    return {
                        'name': name,
                        'ip': item['PublicIpAddress'][0],
                        'ssh_username': AliCloud.InstanceSystemName,
                        'ssh_password': AliCloud.InstancePassword
                    };
                } else {
                    throw new Error('convertToSSHRequest occurred error: Normal instances not match request');
                }
            } else if (type === common.CLOUD_INSTANCE_TYPE_HIGH) {
                if (instances[index.high] && instances[index.high].length > 0) {
                    let item = instances[index.high].pop();
                    return {
                        'name': name,
                        'ip': item['PublicIpAddress'][0],
                        'ssh_username': AliCloud.InstanceSystemName,
                        'ssh_password': AliCloud.InstancePassword
                    };
                } else {
                    throw new Error('convertToSSHRequest occurred error: High instances not match request');
                }
            }
        };

        if (request.ordererOrg) {
            let ordererOrg = request.ordererOrg;
            if (ordererOrg.ca) {
                request.ordererOrg.ca = convert(ordererOrg.ca.name, ordererOrg.ca.type);
            }
            if (ordererOrg.orderer && ordererOrg.orderer.length > 0) {
                let orderers = [];
                for (let v of ordererOrg.orderer) {
                    orderers.push(convert(v.name, v.type));
                }
                request.ordererOrg.orderer = orderers;
            }
        }

        if (request.peerOrgs && request.peerOrgs.length > 0) {
            let peers = [];
            for (let item of request.peerOrgs) {
                let obj = {name: item.name};
                if (item.ca) {
                    obj.ca = convert(item.ca.name, item.ca.type);
                }
                if (item.peers && item.peers.length > 0) {
                    let items = [];
                    for (let v of item.peers) {
                        items.push(convert(v.name, v.type));
                    }
                    obj.peers = items;
                }
                peers.push(obj);
            }
            request.peerOrgs = peers;
        }

        if (request.consensus === common.CONSENSUS_KAFKA) {
            if (request.kafka && request.kafka.length > 0) {
                let kafkas = [];
                for (let v of request.kafka) {
                    kafkas.push(convert(v.name, v.type));
                }
                request.kafka = kafkas;
            }
            if (request.zookeeper && request.zookeeper.length > 0) {
                let zks = [];
                for (let v of request.zookeeper) {
                    zks.push(convert(v.name, v.type));
                }
                request.zookeeper = zks;
            }
        }
    }
};
