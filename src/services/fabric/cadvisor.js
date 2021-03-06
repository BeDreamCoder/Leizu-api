/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Client = require('../transport/client');
const common = require('../../libraries/common');
const utils = require('../../libraries/utils');
const config = require('../../env');
const images = require('../../images');
const consulClient = require('../../services/consul/client');

module.exports = class CAdvisorService {

    static async create(params) {
        const {username, password, host, port} = params;
        const cAdvisorName = 'cadvisor';
        const consulName = 'consul-client';
        let cAdvisorPort = common.PORT.CADVISOR;

        let containerOptions = {
            image: images.middleware.cadvisor,
            cAdvisorName,
            port: cAdvisorPort,
        };
        let connectionOptions = {
            host: host,
            username: username,
            password: password,
            port: port || config.ssh.port
        };

        const client = Client.getInstance(connectionOptions);
        const networkOptions = utils.generateContainerNetworkOptions({name: common.DEFAULT_NETWORK.NAME});
        await client.createContainerNetwork(networkOptions);
        await client.checkImage(containerOptions.image);
        const parameters = utils.generateCadvisorContainerOptions(containerOptions);
        const container = await client.createContainer(parameters);
        await utils.wait(`${common.PROTOCOL.TCP}:${host}:${cAdvisorPort}`);
        if (!container) {
            throw new Error('create peer failed');
        }

        let consulOptions = {
            image: images.middleware.consul,
            consulName,
            host: host,
            consulServer: process.env.PROMETHEUS_HOST || config.prometheus.host
        };
        let consulPort = common.PORT.CONSUL_PORT;
        const consulParameters = utils.generateConsulContainerOptions(consulOptions);
        await client.checkImage(consulOptions.image);
        const consulContainer = await client.createContainer(consulParameters);
        await utils.wait(`${common.PROTOCOL.TCP}:${host}:${consulPort}`);
        if (!consulContainer) {
            throw new Error('create peer failed');
        } else {
            await this.registerService(params);
        }
        let filebeatOptions = {
            image: images.middleware.filebeat,
            filebeatName: 'filebeat',
            elasticsearchHost: process.env.ELASTICSEARCH_HOST ||
                `${config.elasticsearch.host}:${config.elasticsearch.port}`,
        };
        const filebeatParameters = utils.generateFileBeatContainerOptions(filebeatOptions);
        await client.checkImage(filebeatOptions.image);
        const filebeatContainer = await client.createContainer(filebeatParameters);
        if (!filebeatContainer) {
            throw new Error('create filebeat server failed');
        }
        return true;
    }

    static async registerService(params) {
        let client = new consulClient(params.host, common.PORT.CONSUL_PORT);
        let result = await client.querySelf();
        let options = {
            Datacenter: result.Datacenter,
            Node: result.NodeID,
            Address: params.host,
            TaggedAddresses: {
                lan: params.host,
                wan: params.host
            },
            Service: {
                Service: common.CADVISOR_SERVICE_NAME,
                Address: params.host,
                Port: common.PORT.CADVISOR
            }
        };
        let res = await client.putService(options);
        if (!res) {
            throw new Error('service register failed');
        }
    }

    static async registerFabricService(service) {
        let client = new consulClient(service.host, common.PORT.CONSUL_PORT);
        let result = await client.querySelf();
        let options = {
            Datacenter: result.Datacenter,
            Node: result.NodeID,
            Address: service.host,
            TaggedAddresses: {
                lan: service.host,
                wan: service.host
            },
            Service: {
                Service: service.name,
                Address: service.host,
                Port: service.port
            }
        };
        let res = await client.putService(options);
        if (!res) {
            throw new Error('service register failed');
        }
    }
};
