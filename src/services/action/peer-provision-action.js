/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Action = require('./action');
const utils = require('../../libraries/utils');
const PeerService = require('../fabric/peer');

module.exports = class PeerProvisionAction extends Action {
    constructor() {
        super();
    }

    async execute() {
        let params = this.context.get(this.registry.CONTEXT.PARAMS);
        let options = {
            name: params.name,
        };
        utils.extend(options, params);
        return await PeerService.create(options);
    }
};
