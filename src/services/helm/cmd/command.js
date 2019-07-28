/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

module.exports = {
    DefaultHelmCommand: 'helm',
    OutputCommand: '--output',
    CommandList: {
        debug: {
            command: '--debug'
        },
        home: {
            command: '--home',
            type: 'string'
        },
        host: {
            command: '--host',
            type: 'string'
        },
        kobeContext: {
            command: '--kube-context',
            type: 'string'
        },
        kubeconfig: {
            command: '--kubeconfig',
            type: 'string'
        },
        tillerConnectionTimeout: {
            command: '--tiller-connection-timeout',
            type: 'int'
        },
        tillerNamespace: {
            command: '--tiller-namespace',
            type: 'string'
        }
    }
};
