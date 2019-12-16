var Helm = require('../../src/services/helm/api/tiller-client');
// var helm = new Helm('grpc://127.0.0.1:44134');

var helm = new Helm();

// helm.list().then(res => {
//     console.log(res);
// }, err => {
//     console.log(err);
// });


// helm.install({chartName: 'chartmuseum/fabric-ca', namespace: 'fabric'}).then(res=> {
//     console.log(res);
// }, err => {
//     console.log(err);
// });

// helm.listRepos().then(res => {
//     console.log(res);
// }, err => {
//     console.log(err);
// });

// helm.addRepo('chartmuseum', 'http://127.0.0.1:8081').then(res => {
//     console.log(res);
// }, err => {
//     console.log(err);
// });

// helm.removeRepo('chartmuseum').then(res => {
//     console.log(res);
// }, err => {
//     console.log(err);
// });
// helm.listReleases().then(res => {
//     console.log(res);
// }, err => {
//     console.log(err);
// });


helm.installReleases('fabric-ca1', 'chartmuseum/fabric-ca', 'fabric').then(res => {
    console.log(res);
}, err => {
    console.log(err);
});

// helm.getReleases('fabric-ca').then(res => {
//     console.log(res);
// }, err => {
//     console.log(err);
// });

// helm.deleteReleases('fabric-ca').then(res => {
//     console.log(res);
// }, err => {
//     console.log(err);
// });


