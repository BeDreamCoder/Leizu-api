/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Action = require('./action');
const utils = require('../../libraries/utils');
const OrderService = require('../fabric/orderer');

module.exports = class OrdererProvisionAction extends Action {

    async execute() {
        let params = this.context.get(this.registry.CONTEXT.PARAMS);
        let configuration = {
            domainName: utils.generateDomainName(params.name),
        };
        utils.extend(configuration, params);
        if (this.isDebugMode) {
            configuration.ordererPort = utils.generateRandomHttpPort();
        }
        return await OrderService.create(configuration);
    }

};
