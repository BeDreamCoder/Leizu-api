const grpc = require('grpc');
const resolve = require('path').resolve;

const protoPath = resolve(__dirname, 'protos');
const hello_proto = grpc.load({
    file: '/greeter.proto',
    root: protoPath
}).protos;

var client = new hello_proto.Greeter('localhost:50051',
    grpc.credentials.createInsecure());
client.sayHello({name: 'you'}, function (err, response) {
    console.log('Greeting:', response.message);
});
//
// var call = client.sayHello({name: 'you'});
// call.on('data', function (feature) {
//     console.log('1', feature);
// });
// call.on('end', function () {
//     // The server has finished sending
//     console.log('2');
// });
// call.on('error', function (e) {
//     // An error has occurred and the stream has been closed.
//     console.log('3', e);
// });
// call.on('status', function (status) {
//     // process status
//     console.log('4', status);
// });