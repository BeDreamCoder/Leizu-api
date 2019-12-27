/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const DbService = require('../db/dao');
const InviteOrganization = require('../../models/inviteorganization');
const logger = require('../../libraries/log4js');
const comm = require('../../libraries/common');

module.exports = class OrganizationService {

    static async createInviteOrg (name,contactname,consortiumId,channelId){
        let inviteorganization = new InviteOrganization();
        inviteorganization.name = name;
        inviteorganization.contactname = contactname;
        inviteorganization.inviteCode = OrganizationService.generateInviteCode(false,6,6);
        inviteorganization.consortiumId = consortiumId;
        inviteorganization.channelId = channelId;
        try {
            inviteorganization = await DbService.addInviteOrganization(inviteorganization);
            return inviteorganization;
        } catch (err) {
            logger.error(err);
            return null;
        }
    }

    static async registerUser(dto){
        let user = {};
        try{
            user = await DbService.addUser(dto);
            await InviteOrganization.findOneAndUpdate({inviteCode:dto.inviteCode},{status:comm.INVITE_CODE_USED});
            return user;
        }catch (e) {
            logger.error(e);
            return null;
        }
    }

    static generateInviteCode  (randomFlag, min ,max) {
        let arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        let str ='';
        let range = min;
        if (randomFlag){
            range = Math.round(Math.random()*(max-min)) + min;
        }
        for (var i = 0; i < range ; i++){
            let pos = Math.round(Math.random()*(arr.length-1));
            str += arr[pos];
        }
        return str;
    }
};

