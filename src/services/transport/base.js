/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

module.exports = class BaseClient {

    constructor(options) {
        this.options = options;
    }

    setOptions(options){
        this.options = options;
    }

    async exec(parameters) {
        throw new Error('not implemented');
    }

    async transferFile(parameters) {
        throw new Error('not implemented');
    }

    async transferDirectory(parameters) {
        throw new Error('not implemented');
    }

    async checkImage(name) {
        throw new Error('abstract function called');
    }

    async createContainer(parameters) {
        throw new Error('abstract function called');
    }

    async createContainerNetwork(parameters) {
        throw new Error('abstract function called');
    }
};
