/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const uuid = require('uuid/v1');
const RequestModel = require('../../models/request');
const common = require('../../libraries/common');
const Consortium = require('../../models/consortium');

module.exports = class RequestDaoService {

    constructor() {

    }

    async addRequest(dto) {
        let request = new RequestModel();
        request.uuid = uuid();
        request.name = dto.name;
        request.status = common.REQUEST_STATUS_PENDING;
        request.configuration = JSON.stringify(dto);
        request = await request.save();
        dto.requestId = request._id;
        let consortium = await this.addConsortiumByRequest(dto);
        request = request.toObject();
        request.consortiumId = consortium._id;
        return request;
    }

    async addConsortiumByRequest(dto) {
        let consortium = new Consortium();
        consortium.name = dto.name;
        consortium.mode = dto.mode;
        consortium.network = dto.network;
        consortium.type = dto.type;
        consortium.version = dto.version;
        consortium.normal_instance_limit = dto.normalInstanceLimit;
        consortium.high_instance_limit = dto.highInstanceLimit;
        consortium.uuid = uuid();
        //consortium.network_config = JSON.stringify(dto); //update the network config after network is ready.
        consortium.request_id = dto.requestId;
        consortium = await consortium.save();
        return consortium;
    }

    async updateStatusById(id, status) {
        return await RequestModel.findOneAndUpdate({_id: id}, {status: status});
    }

};
