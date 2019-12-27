/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const common = require('./common');
const AliCloud = require('../services/provider/common').AliCloud;
const path = require('path');
const fs = require('fs');
const isReachable = require('is-reachable');
const moment = require('moment');
const logger = require('log4js').getLogger();
const config = require('../env');

module.exports.wait = async (resources) => {
    logger.info('waiting for resources ready: ', resources);

    const waitOn = require('wait-on');

    let options = {
        resources: [].concat(resources),
        delay: 5000,
        interval: 1000,
        log: true,
        verbose: false,
        timeout: 30000,
    };

    try {
        await waitOn(options);
    } catch (err) {
        console.error(err);
        throw new Error(err);
    }
};

module.exports.sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports.extend = (target, source) => {
    if (source === null || typeof source !== 'object') return target;

    const keys = Object.keys(source);
    let i = keys.length;
    while (i--) {
        target[keys[i]] = source[keys[i]];
    }
    return target;
};


module.exports.generateCAContainerOptions = (options) => {
    return [
        'create',
        '--name', options.caName,
        '-e', 'GODEBUG=netdns=go',
        '-e', `FABRIC_CA_SERVER_HOME=${common.CA_CFG_PATH}`,
        '-e', `FABRIC_CA_SERVER_CA_NAME=${options.caName}`,
        '-e', `FABRIC_CA_SERVER_CSR_CN=${options.caName}`,
        '-e', `FABRIC_CA_SERVER_TLS_ENABLED=${options.tlsEnabled}`,
        '-p', options.port + ':7054',
        '-v', `${options.cfgPath}:${common.CA_CFG_PATH}`,
        options.image,
        '/bin/bash', '-c',
        'fabric-ca-server start -b ' + `${options.enrollmentID}:${options.enrollmentSecret}` + ' ' +
        '--cfg.affiliations.allowremove --cfg.identities.allowremove -d'
    ];
};

module.exports.generateContainerNetworkOptions = (options) => {
    options = options || {};
    return [
        'network',
        'create',
        '--driver', options.driver || common.DEFAULT_NETWORK.DRIVER,
        options.name || common.DEFAULT_NETWORK.NAME
    ];
};

module.exports.generatePeerContainerOptions = (options) => {
    const {consortiumId, image, hostname, mspId, port, metricsPort, cfgPath, workDir, enableTls, logLevel} = options;

    let metricsEnv = [];
    if (this.metricsEnabled()) {
        metricsEnv.push.apply(metricsEnv, ['-p', `${metricsPort}:9443`,
            '-e', 'CORE_METRICS_PROVIDER=prometheus',
            '-e', `CORE_OPERATIONS_LISTENADDRESS=${hostname}:9443`]);
    }
    return [
        'create',
        '--name', hostname,
        '--hostname', hostname,
        '--network', common.DEFAULT_NETWORK.NAME,
        '-p', `${port}:7051`,
        '-w', workDir,
        '-e', 'CORE_VM_ENDPOINT=unix:///var/run/docker.sock',
        '-e', 'CORE_VM_DOCKER_ATTACHSTDOUT=true',
        '-e', `CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=${common.DEFAULT_NETWORK.NAME}`,
        '-e', 'GODEBUG=netdns=go',
        '-e', `CORE_PEER_ID=${hostname}`,
        '-e', `CORE_PEER_ADDRESS=${hostname}:7051`,
        '-e', 'CORE_PEER_LISTENADDRESS=0.0.0.0:7051',
        '-e', `CORE_PEER_CHAINCODEADDRESS=${hostname}:7052`,
        '-e', 'CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052',
        '-e', `CORE_PEER_LOCALMSPID=${mspId}`,
        '-e', `CORE_PEER_MSPCONFIGPATH=${common.FABRIC_CFG_PATH}/msp`,
        '-e', `CORE_PEER_GOSSIP_EXTERNALENDPOINT=${hostname}:7051`,
        '-e', 'CORE_PEER_GOSSIP_ORGLEADER=false',
        '-e', 'CORE_PEER_GOSSIP_USELEADERELECTION=true',
        '-e', `CORE_PEER_TLS_ENABLED=${enableTls}`,
        '-e', `CORE_PEER_TLS_CERT_FILE=${common.FABRIC_CFG_PATH}/tls/server.crt`,
        '-e', `CORE_PEER_TLS_KEY_FILE=${common.FABRIC_CFG_PATH}/tls/server.key`,
        '-e', `CORE_PEER_TLS_ROOTCERT_FILE=${common.FABRIC_CFG_PATH}/tls/ca.pem`,
        // '-e', 'CORE_PEER_TLS_CLIENTAUTHREQUIRED=true',
        // '-e', `CORE_PEER_TLS_CLIENTROOTCAS_FILES=${common.FABRIC_CFG_PATH}/tls/ca.pem`,
        '-e', `CORE_LOGGING_LEVEL=${logLevel}`,
        '-e', `FABRIC_LOGGING_SPEC=${logLevel}`].concat(metricsEnv).concat([
        '-v', '/var/run:/var/run',
        '-v', `${cfgPath}/msp:${common.FABRIC_CFG_PATH}/msp`,
        '-v', `${cfgPath}/tls:${common.FABRIC_CFG_PATH}/tls`,
        '--dns', process.env.COREDNS_HOST || config.coredns,
        '--dns-search', consortiumId,
        image,
        '/bin/bash', '-c', 'peer node start',
    ]);
};

module.exports.generateOrdererContainerOptions = (options) => {
    const {
        consortiumId, image, hostname, mspId, port, metricsPort,
        cfgPath, workDir, enableTls, logLevel, tlsRootCas
    } = options;
    let ordererCfgPath = `${common.FABRIC_CFG_PATH}/orderer`;
    let cas = [];
    for (let key in tlsRootCas) {
        cas.push(`${ordererCfgPath}/tlsrootcas/ca${key}.crt`);
    }
    cas.push(`${ordererCfgPath}/msp/tlscacerts/cert.pem`);

    let metricsEnv = [];
    if (this.metricsEnabled()) {
        metricsEnv.push.apply(metricsEnv, ['-p', `${metricsPort}:8443`,
            '-e', 'ORDERER_METRICS_PROVIDER=prometheus',
            '-e', `ORDERER_OPERATIONS_LISTENADDRESS=${hostname}:8443`]);
    }
    return [
        'create',
        '--name', hostname,
        '--hostname', hostname,
        '--network', common.DEFAULT_NETWORK.NAME,
        '-w', workDir,
        '-p', `${port}:7050`,
        '-e', 'GODEBUG=netdns=go',
        '-e', `ORDERER_GENERAL_LOGLEVEL=${logLevel}`,
        '-e', `FABRIC_LOGGING_SPEC=${logLevel}`,
        '-e', 'ORDERER_GENERAL_LISTENADDRESS=0.0.0.0',
        '-e', 'ORDERER_GENERAL_GENESISMETHOD=file',
        '-e', `ORDERER_GENERAL_GENESISFILE=${ordererCfgPath}/genesis.block`,
        '-e', `ORDERER_GENERAL_LOCALMSPID=${mspId}`,
        '-e', `ORDERER_GENERAL_LOCALMSPDIR=${ordererCfgPath}/msp`,
        '-e', `ORDERER_GENERAL_TLS_ENABLED=${enableTls}`,
        '-e', `ORDERER_GENERAL_TLS_CERTIFICATE=${ordererCfgPath}/tls/server.crt`,
        '-e', `ORDERER_GENERAL_TLS_PRIVATEKEY=${ordererCfgPath}/tls/server.key`,
        '-e', `ORDERER_GENERAL_TLS_ROOTCAS=[${cas}]`,
        // '-e', `ORDERER_GENERAL_TLS_CLIENTAUTHREQUIRED=${enableTls}`,
        // '-e', `ORDERER_GENERAL_TLS_CLIENTROOTCAS=[${ordererCfgPath}/msp/tlscacerts/cert.pem]`,
        '-e', `ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=${ordererCfgPath}/tls/server.crt`,
        '-e', `ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=${ordererCfgPath}/tls/server.key`,
        '-e', `ORDERER_GENERAL_CLUSTER_ROOTCAS=[${cas}]`].concat(metricsEnv).concat([
        '-v', '/var/run:/var/run',
        '-v', `${cfgPath}/msp:${ordererCfgPath}/msp`,
        '-v', `${cfgPath}/tls:${ordererCfgPath}/tls`,
        '-v', `${cfgPath}/tlsrootcas:${ordererCfgPath}/tlsrootcas`,
        '-v', `${cfgPath}/genesis.block:${ordererCfgPath}/genesis.block`,
        '--dns', process.env.COREDNS_HOST || config.coredns,
        '--dns-search', consortiumId,
        image,
        '/bin/bash', '-c', 'orderer',
    ]);
};

module.exports.generateCadvisorContainerOptions = (options) => {
    const {image, cAdvisorName, port} = options;
    return [
        'create',
        '--name', `${cAdvisorName}`,
        '--network', common.DEFAULT_NETWORK.NAME,
        '--privileged=true',
        '-p', `${port}:8080`,
        '-v', '/:/rootfs:ro',
        '-v', '/var/run:/var/run:rw',
        '-v', '/sys:/sys:ro',
        '-v', '/var/lib/docker/:/var/lib/docker:ro',
        image,
    ];
};

module.exports.generateConsulContainerOptions = (options) => {
    const {image, consulName, host, consulServer} = options;
    return [
        'create',
        '--name', `${consulName}`,
        '--network', common.DEFAULT_NETWORK.NAME,
        // '--net', 'host',
        '-p', '8301:8301',
        '-p', '8301:8301/udp',
        '-p', '8500:8500',
        image,
        'agent', '-client=0.0.0.0', `-join=${consulServer}`, `-advertise=${host}`,
    ];
};

module.exports.generateFileBeatContainerOptions = (options) => {
    const {image, filebeatName, elasticsearchHost} = options;
    return [
        'create',
        '--name', filebeatName,
        '--user', 'root',
        '--network', common.DEFAULT_NETWORK.NAME,
        '--restart', 'always',
        '-v', '/var/lib/docker/containers:/var/lib/docker/containers:ro',
        '-v', '/var/run/docker.sock:/var/run/docker.sock:ro',
        '-e', '-strict.perms=false',
        '-e', `ELASTIC_SEARCH_HOST=${elasticsearchHost}`,
        image,
    ];
};

module.exports.createDir = (dirpath, mode) => {
    try {
        let pathTmp;
        dirpath.split(/[/\\]/).forEach(async function (dirName) {
            if (!pathTmp && dirName === '') {
                pathTmp = '/';
            }
            pathTmp = path.join(pathTmp, dirName);
            if (!fs.existsSync(pathTmp)) {
                fs.mkdirSync(pathTmp, mode);
            }
        });
    } catch (e) {
        throw e;
    }
};

module.exports.generateRandomHttpPort = () => {
    return exports.generateRandomInteger(1024, 65535);
};

module.exports.generateRandomInteger = (low, high) => {
    return Math.floor(Math.random() * (high - low) + low);
};

module.exports.isStandalone = () => {
    return (process.env.RUN_MODE || config.runMode) === common.RUN_MODE.STANDALONE;
};

module.exports.metricsEnabled = () => {
    return (process.env.METRICS_ENABLED || config.metricsEnabled) === true;
};

module.exports.makeHostRecord = (hostName, ipAddress) => {
    return hostName + common.SEPARATOR_COLON + ipAddress;
};

module.exports.getUrl = (location, enableTls) => {
    if (enableTls) {
        return `${common.PROTOCOL.GRPCS}://${location}`;
    } else {
        return `${common.PROTOCOL.GRPC}://${location}`;
    }
};

module.exports.setupChaincodeDeploy = () => {
    if (!process.env.GOPATH) {
        process.env.GOPATH = common.CHAINCODE_GOPATH;
    }
};

module.exports.replacePeerName = (name) => {
    if (name) {
        let pattern = /-\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}/;
        return name.replace(pattern, '');
    } else {
        return name;
    }
};

module.exports.isReachable = async (host) => {
    let result = await isReachable(host);
    if (!result) {
        logger.error('Service unavailable:', host);
    }
    return result;
};

module.exports.getInstanceType = (instanceType) => {
    switch (instanceType) {
        case common.CLOUD_INSTANCE_TYPE_NORMAL:
            return AliCloud.InstanceTypeNormal;
        case common.CLOUD_INSTANCE_TYPE_HIGH:
            return AliCloud.InstanceTypeHigh;
        default:
            return AliCloud.InstanceTypeNormal;
    }
};

module.exports.getTxNumber = (block) => {
    let txNumber = 0;
    block.data.data.map(item => {
        const {
            payload: {
                header: {
                    channel_header: {
                        'tx_id': txId,
                    }
                }
            }
        } = item;
        if (txId) txNumber++;
    });
    return txNumber;
};

module.exports.decodeBlock = (block) => {
    const hash = block.hash || block.header.data_hash;
    let txNumber = 0;
    let txTimestamps = [];
    block.data.data.map(item => {
        const {
            payload: {
                header: {
                    channel_header: {
                        'tx_id': txId,
                        timestamp
                    }
                }
            }
        } = item;
        if (txId) txNumber++;
        txTimestamps.push(moment(timestamp).local().format('YYYY-MM-DD HH:mm:ss'));
    });
    txTimestamps.sort((a, b) => a - b);
    return {
        hash,
        transactions: txNumber,
        timestamp: txTimestamps.pop(),
    };
};

module.exports.getTxs = block => {
    let transactions = [];
    block.data.data.map(item => {
        const {
            payload: {
                header: {
                    channel_header: {
                        'tx_id': txId,
                        timestamp
                    }
                }
            }
        } = item;
        if (txId) {
            transactions.push({
                id: txId,
                timestamp: moment(timestamp).local().format('YYYY-MM-DD HH:mm:ss'),
            });
        }
    });
    return transactions;
};

module.exports.inspectBlock = block => {
    const {
        header: {
            'previous_hash': previousHash,
            'data_hash': dataHash,
            number,
        },
    } = block;
    let txList = [];
    block.data.data.map(item => {
        const {
            payload: {
                header: {
                    channel_header: {
                        'tx_id': txId,
                        timestamp,
                        'channel_id': channelId
                    }
                }
            }
        } = item;
        txList.push({
            id: txId,
            timestamp: moment(timestamp).local().format('YYYY-MM-DD HH:mm:ss'),
            channelId
        });
    });
    return {
        txList,
        blockHeight: number,
        previousHash,
        dataHash,
    };
};

module.exports.decodeTransaction = transaction => {
    const regex = /[A-Za-z0-9\u4e00-\u9fa5.,?"'!@#$%^&*()-_=+;:<>|{}\\[\]`~]/;
    const {
        transactionEnvelope: {
            payload: {
                data: {
                    actions
                }
            }
        },
        validationCode,
    } = transaction;
    const action = actions.length ? actions[0] : {};
    const {
        payload: {
            chaincode_proposal_payload: {
                input: {
                    'sender_spec': senderSpec,
                    chaincode_spec: {
                        type,
                        chaincode_id: {
                            name
                        },
                        input: {
                            args
                        }
                    }
                }
            }
        }
    } = action;
    const payloadAction = action.payload.action;
    const endorsements = payloadAction.endorsements;
    const endorser = endorsements.length > 0 ? endorsements[0].endorser.Mspid : '';
    const endorserId = endorsements.length > 0 ? endorsements[0].endorser.IdBytes : '';
    const sender = senderSpec ? senderSpec.sender || '' : '';
    return {
        validationCode,
        type,
        name,
        endorser,
        endorserId,
        sender,
        args: args.map(arg => {
            if (typeof arg === 'object') {
                return arg;
            } else {
                let escape = '';
                for (let a of arg) {
                    escape += regex.test(a) ? a : ' ';
                }
                escape = escape.replace(/  +/g, ' ').trim();
                return /^[A-Za-z0-9\u4e00-\u9fa5]/.test(escape)
                    ? escape
                    : escape.substring(1).trim();
            }
        }),
    };
};
