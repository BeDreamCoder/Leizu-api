/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const shell = require('shelljs');
const escape = require('shell-escape');
var Command = require('./command');
const logger = require('log4js').getLogger('ShellHandler');

module.exports = class ShellHandler {
    constructor(options) {
        this.cmd = options.cmd ? options.cmd : Command.DefaultHelmCommand;
        shell.config.silent = true;
    }

    async execCommand(parameters) {
        try {
            // return shell.exec(this.formatCommand(parameters)).stdout.trim();
            return new Promise((resolve, reject) => {
                shell.exec(this.formatCommand(parameters), function (code, stdout, stderr) {
                    if (code === 0) {
                        resolve(stdout);
                    } else {
                        reject(stderr);
                    }
                });
            });
        } catch (err) {
            throw err;
        }
    }

    optionalCommand(command, options) {
        if (options) {
            for (let key in Command.CommandList) {
                if (options.hasOwnProperty(key)) {
                    let option = Command.CommandList[key];
                    command.push(option.command);
                    if (option.type) {
                        command.push(options[key]);
                    }
                }
            }
        }
    }

    formatCommand(parameters = []) {
        const command = [this.cmd].concat(escape(parameters)).join(' ');
        logger.debug('The full command to be run: %s', command);
        return command;
    }
};
