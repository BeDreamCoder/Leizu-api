'use strict';

const User = require('../../models/user');
const jwt = require('../../libraries/jwt');

const {BadRequest, Unauthorized} = require('../../libraries/error');
const string = require('../../libraries/string');
const router = require('koa-router')({prefix: '/user'});

router.post('/login', async (ctx) => {
    ctx.checkBody('username').notEmpty('Name field is required').len(4, 50, 'Name length must be between 4 and 50 characters');
    ctx.checkBody('password').notEmpty('Password field is required').len(4, 20, 'Password length must be between 4 and 20 characters');

    if (ctx.errors) throw new BadRequest(ctx.errors);

    const {username, password} = ctx.request.body;
    const user = await getUser(username, password);

    ctx.body = {
        id: user._id,
        username: user.toJSON().username,
        token: jwt.encode({id: user._id}),
    };
});

router.post('/password/reset', async (ctx) => {
    const {username, password, newPassword} = ctx.request.body;
    const user = await getUser(username, password);
    const newUser = await User.findOneAndUpdate({_id: user._id}, {password: string.generatePasswordHash(newPassword)}, {new: true});
    ctx.body = {
        id: newUser._id,
        username: newUser.toJSON().username
    };
});

const getUser = async (username, password) => {
    const user = await User.findOne({
        username: username,
        password: string.generatePasswordHash(password),
    });

    if (!user) throw new Unauthorized('Invalid Credentials');

    return user;
};


module.exports = router;
