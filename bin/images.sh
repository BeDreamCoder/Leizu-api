#!/usr/bin/env bash

# install docker

apt-get update -qq
apt-get install -y apt-transport-https ca-certificates
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -

add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

apt-get install -y docker-ce

# install unzip

apt-get install unzip

# port list: 7050 7051 7052 7053 7054 2181 2888 3888 9092 9093

# download images

TAG=latest

docker pull hyperledger/fabric-ca:${TAG}
docker pull hyperledger/fabric-ca-peer:${TAG}
docker pull hyperledger/fabric-ca-orderer:${TAG}
docker pull hyperledger/fabric-kafka:${TAG}
docker pull hyperledger/fabric-zookeeper:${TAG}