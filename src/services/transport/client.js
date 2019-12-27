/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const utils = require('../../libraries/utils');
const SshClient = require('./ssh');
const ShellClient = require('./shell');

module.exports = class TransportClient {

    constructor(client) {
        this.client = client;
    }

    static getInstance(options) {
        let client = null;
        if (utils.isStandalone()) {
            client = new ShellClient(options);
        } else {
            client = new SshClient(options);
        }
        return new TransportClient(client);
    }

    async checkImage(name) {
        return await this.client.checkImage(name);
    }

    async createContainer(parameters) {
        return await this.client.createContainer(parameters);
    }

    async createContainerNetwork(parameters) {
        return await this.client.createContainerNetwork(parameters);
    }

    async transferFile(parameters) {
        await this.client.transferFile(parameters);
    }

    async transferDirectory(parameters) {
        await this.client.transferDirectory(parameters);
    }

    async setOptions(parameters) {
        await this.client.setOptions(parameters);
    }

    async exec(parameters) {
        await this.client.exec(parameters);
    }
};
