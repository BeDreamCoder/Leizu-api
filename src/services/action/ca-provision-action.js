/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Action = require('./action');
const utils = require('../../libraries/utils');
const OrganizationService = require('../fabric/organization');

module.exports = class CAProvisionAction extends Action {
    constructor() {
        super();
    }

    async execute() {
        let params = this.context.get(this.registry.CONTEXT.PARAMS);
        let options = {
            //name: params.caName,
            name: params.orgName,
            type: params.type,
            consortiumId: params.consortiumId.toString(),
        };
        utils.extend(options, params.caNode);
        return await OrganizationService.create(options);
    }
};
