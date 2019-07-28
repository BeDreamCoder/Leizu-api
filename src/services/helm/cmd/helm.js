/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const ShellHanlder = require('./shell');

module.exports = class Helm {
    constructor(options = {}) {
        this.command = [];
        this.executer = new ShellHanlder(options);
        this.executer.optionalCommand(this.command, options);
    }

    async install(options) {
        let command = ['install'];
        if (options.chartName == null) {
            throw new Error('Missing required parameter \'chartName\'');
        }
        command.push(options.chartName);

        if (options.releaseName) {
            command.push('--name');
            command.push(options.releaseName);
        }
        if (options.namespace) {
            command.push('--namespace');
            command.push(options.namespace);
        }
        if (options.version) {
            command.push('--version');
            command.push(options.version);
        }
        // if (options.values) {
        //     command.push('--set');
        //     command.push(helperMethods.flattenValuesToString(options.values));
        // }
        try {
            let result = await this.executer.execCommand(command.concat(this.command));
            return result;
        } catch (err) {
            throw err;
        }
    }

    upgrade(options) {
        let command = ['upgrade', options.releaseName];
        if (options.chartName == null) {
            throw new Error('Missing parameter \'chartName\'');
        }
        command.push(options.chartName);
        if (options.version) {
            command.push('--version');
            command.push(options.version);
        }
        if (options.values) {
            command.push('--set');
            var valuesString = helperMethods.flattenValuesToString(options.values);
            valuesString = valuesString.slice(0, -1);
            command.push(valuesString);
        }
        if (options.reuseValues) {
            command.push('--reuse-values');
        }

        return this.executer.execCommand(command.concat(this.command));
    }

    delete(options) {
        let command = ['delete'];
        if (options.releaseName == null) {
            throw new Error('Missing parameter \'releaseName\'');
        }
        command.push(options.releaseName);
        if (options.shouldPurge) {
            command.push('--purge');
        }

        return this.executer.execCommand(command.concat(this.command));
    }

    list() {
        let command = ['list'];

        return this.executer.execCommand(command.concat(this.command));
    }

    get(options) {
        let command = ['get'];
        if (options.releaseName == null) {
            throw new Error('Missing parameter \'releaseName\'');
        }
        command.push(options.releaseName);

        return this.executer.execCommand(command.concat(this.command));
    }

    history(options) {
        let command = ['history'];
        if (options.releaseName == null) {
            throw new Error('Missing parameter \'releaseName\'');
        }
        command.push(options.releaseName);

        return this.executer.execCommand(command.concat(this.command));
    }

    status(options) {
        let command = ['status'];
        if (options.releaseName == null) {
            throw new Error('Missing parameter \'releaseName\'');
        }
        command.push(options.releaseName);

        return this.executer.execCommand(command.concat(this.command));
    }

    rollback(options) {
        let command = ['rollback'];
        if (options.releaseName == null) {
            throw new Error('Missing parameter \'releaseName\'');
        }
        if (options.revision == null) {
            throw new Error('Missing parameter \'revision\'');
        }
        command.push(options.releaseName);
        command.push(options.revision);

        return this.executer.execCommand(command.concat(this.command));
    }
};
