
const grpc = require('grpc');
const resolve = require('path').resolve;

const protoPath = resolve(__dirname, 'protos');
const hello_proto = grpc.load({
    file: '/greeter.proto',
    root: protoPath
}).protos;

// function sayHello(call, callback) {
//     callback(null, {message: 'Hello ' + call.request.name});
// }

function sayHello(call) {
    call.write({message: 'Hello ' + call.request.name});
    call.end();
}

function main() {
    var server = new grpc.Server();
    server.addProtoService(hello_proto.Greeter.service,
        {sayHello: sayHello});
    server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
    server.start();
}

main();