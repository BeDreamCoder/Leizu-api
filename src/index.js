/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

const Koa = require('koa');
const fs = require('fs');
const path = require('path');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const errorHandler = require('./libraries/error-handler');
const config = require('./env');
const auth = require('./middlewares/auth');

const swagger = require('swagger2');
const {ui} = require('swagger2-koa');

const app = new Koa();
app.config = config;
app.mongoose = require('./libraries/db');
if (config.koaLogger) {
    const logger = require('koa-logger');
    app.use(logger());
}

app.use(cors());
app.use(errorHandler);
app.use(bodyParser());

const swaggerYaml = path.join(__dirname, '../dist/swagger.yml');
const document = swagger.loadDocumentSync(swaggerYaml);
if (!swagger.validateDocument(document)) {
    throw Error('swagger.yml does not conform to the Swagger 2.0 schema');
}
app.use(ui(document, '/', ['/api/v1']));

const publicUrls = [
    /^\/$/,
    /^\/api-docs\/?$/,
    /^\/api\/v1\/?$/,
    /^\/api\/v1\/user\/login\/?$/,
];

app.use(async (ctx, next) => {
    try {
        if (publicUrls.find(pattern => ctx.url.match(pattern))) {
            return next();
        }
        await auth(ctx, next);
    } catch (e) {
        ctx.throw(401, e);
    }
});

// validator
require('koa-validate')(app);

// set routes
const appDirectory = path.join(__dirname, 'app');
fs.readdirSync(appDirectory)
    .filter(file => fs.statSync(path.join(appDirectory, file)).isDirectory())
    .forEach((moduleName) => {
        fs.readdirSync(`${appDirectory}/${moduleName}`)
            .filter(file => fs.statSync(path.join(`${appDirectory}/${moduleName}`, file)).isFile())
            .forEach((route) => {
                app.use(require(`${appDirectory}/${moduleName}/${route}`).prefix('/api/v1').routes());
            });
    });

module.exports = app;
