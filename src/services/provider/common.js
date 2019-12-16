/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

'use strict';

module.exports.AliCloud = {
    RegionId: 'cn-huhehaote',
    VpcName: 'vpc-zig-cloud',
    VpcCidrBlock: '172.16.0.0/12',
    VSwitchName: 'vsw-zig-cloud',
    VSwitchCidrBlock: '172.16.0.0/24',
    SecurityGroupName: 'sg-zig-cloud',
    SGRuleIpProtocol: 'tcp',
    SGRulePortRanges: ['22/22', '7050/7050', '7051/7051', '7052/7052', '7053/7053', '7054/7054',
        '2181/2181', '2888/2888', '3888/3888', '8081/8081', '8500/8500', '9092/9092', '9093/9093', '8443/8443', '9443/9443'],
    InstanceTypeNormal: 'ecs.c5.large',
    InstanceTypeHigh: 'ecs.c5.xlarge',
    SnapshotImageId: 'm-hp37gnhlmrmj25fgnb0y',
    ImageId: 'ubuntu_16_0402_64_20G_alibase_20180409.vhd',
    InstanceName: 'bass-instance',
    InstanceHostName: 'zig-cloud',
    InstanceSystemName: 'root',
    InstancePassword: 'Pass@w0rd',
    InstanceChargeTypePrePaid: 'PrePaid',
    InstanceChargeTypePostPaid: 'PostPaid',
    InstanceChargeTypePeriodUnit: 'Month',
    InstanceChargeTypePeriod: 1,
    InstanceAmount: 1,
};

