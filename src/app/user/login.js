/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const User = require('../../models/user');
const jwt = require('../../libraries/jwt');
const config = require('../../env').jwt;
const common = require('../../libraries/common');

const {BadRequest, SimpleBadRequest} = require('../../libraries/error');
const stringUtil = require('../../libraries/string-util');
const router = require('koa-router')({prefix: '/user'});
const ErrorCode = require('../../libraries/error-code');
const Validator = require('../../libraries/validator/validator');
const Schema = require('../../libraries/validator/schema/user-schema');
const UserService = require('../../services/user/user');
const InviteOrganization = require('../../models/inviteorganization');
const Channel = require('../../models/channel');

router.post('/login', async (ctx) => {
    let res = Validator.JoiValidate('login', ctx.request.body, Schema.loginSchema);
    if (!res.result) throw new BadRequest(res.errMsg);

    const {username, password} = ctx.request.body;
    const {user, code} = await getUser(username, password);
    if (code === ErrorCode.USER_CHECK_USERNAME) {
        ctx.status = 401;
        ctx.body = common.errorWithCode([], 'User not exist', code);
        return;
    } else if (code === ErrorCode.USER_CHECK_PASSWORD) {
        ctx.status = 401;
        ctx.body = common.errorWithCode([], 'Password error', code);
        return;
    }
    const token = jwt.encode({id: user._id});
    await User.findOneAndUpdate({_id: user._id}, {token: token});
    ctx.body = {
        id: user._id,
        username: user.toJSON().username,
        token: token,
    };
});

router.post('/logout', async (ctx) => {
    const token = ctx.request.headers['authorization'];
    try {
        const decoded = jwt.decode(token.split(' ')[1], config.secret);
        await User.findOneAndUpdate({_id: decoded.id,}, {token: ''}, {new: true});
        ctx.body = common.success(null, 'User logged out');
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error(null, err.message);
    }
});

router.post('/password/reset', async (ctx) => {
    let res = Validator.JoiValidate('password reset', ctx.request.body, Schema.resetSchema);
    if (!res.result) throw new BadRequest(res.errMsg);

    const {username, password, newPassword} = ctx.request.body;
    const {user, code} = await getUser(username, password);
    if (code === ErrorCode.USER_CHECK_USERNAME) {
        ctx.status = 401;
        ctx.body = common.errorWithCode([], 'User not exist', code);
        return;
    } else if (code === ErrorCode.USER_CHECK_PASSWORD) {
        ctx.status = 401;
        ctx.body = common.errorWithCode([], 'Password error', code);
        return;
    }
    const newUser = await User.findOneAndUpdate({_id: user._id}, {password: stringUtil.generatePasswordHash(newPassword)}, {new: true});
    ctx.body = {
        id: newUser._id,
        username: newUser.toJSON().username
    };
});

router.get('/check', async (ctx) => {
    if (ctx.currentUser) {
        ctx.body = {username: ctx.currentUser.username};
    }
});

router.post('/invite', async ctx => {
    let res = Validator.JoiValidate('inviteorganization', ctx.request.body, Schema.createInvite);
    if (!res.result) throw new BadRequest(res.errMsg);
    try{
        let user = ctx.currentUser;
        let consortiumIDs = user.consortiumIDs;
        if (!consortiumIDs.includes(ctx.request.body.consortium_id)){
            throw new SimpleBadRequest('this user is not belong to this consortium');
        }
        let channel = await Channel.findOne({consortium_id:ctx.request.body.consortium_id,_id:ctx.request.body.channel_id});
        if (channel === null){
            throw new SimpleBadRequest('channel_id error');
        }
        let inviteorganization = await UserService.createInviteOrg(ctx.request.body.name,ctx.request.body.contactname,ctx.request.body.consortium_id,ctx.request.body.channel_id);
        ctx.body =  inviteorganization;
    } catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

router.post('/register',async ctx => {
    let params = ctx.request.body;
    let res = Validator.JoiValidate('register', params, Schema.registerSchema);
    if (!res.result) throw new BadRequest(res.errMsg);
    let inviteOrganization = await InviteOrganization.findOne({inviteCode: params.inviteCode});
    if (params.password !== params.repassword){
        throw new SimpleBadRequest('Two input password must be consistent');
    }
    if (common.INVITE_CODE_USED === inviteOrganization.status ){
        throw new SimpleBadRequest('invalid inviteCode');
    }
    let cIds = [];
    cIds.push(inviteOrganization.consortiumId);
    let user = {
        username:params.username,
        password:params.password,
        consortiumIDs:cIds,
        orgName:params.orgName,
        inviteCode:inviteOrganization.inviteCode
    };
    let result ={};
    try{
        result = await UserService.registerUser(user);
        ctx.body = result;
    }catch (err) {
        ctx.status = 400;
        ctx.body = common.error({}, err.message);
    }
});

const getUser = async (username, password) => {
    const user = await User.findOne({username: username});
    let code = ErrorCode.SUCCESS_CODE;
    if (!user) {
        code = ErrorCode.USER_CHECK_USERNAME;
        return {code, user};
    }
    if (user.password !== stringUtil.generatePasswordHash(password)) {
        code = ErrorCode.USER_CHECK_PASSWORD;
        return {code, user};
    }

    return {code, user};
};


module.exports = router;
