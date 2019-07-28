# Copyright Zhigui.com. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0

# port list: 22 7050 7051 7052 7053 7054 2181 2888 3888 8081 8500 9092 9093

#!/usr/bin/env bash

# if version not passed in, default to latest released version
#export FABRIC_TAG=1.2.1
#export FABRIC_TAG=1.3.0
export FABRIC_TAG=1.4.1
# if ca version not passed in, default to latest released version
export CA_TAG=$FABRIC_TAG
# current version of thirdparty images (couchdb, kafka and zookeeper) released
export THIRDPARTY_TAG=0.4.15

dockerInstall() {
  which docker >& /dev/null
  NODOCKER=$?
  if [ "${NODOCKER}" == 0 ]; then
    dockerPull
  else
    echo "===> Docker not installed, start install docker"
    source /etc/os-release
    case $ID in
    debian|ubuntu|devuan)
        ubuntuDocker
        ;;
    centos|fedora|rhel)
        yumdnf="yum"
        if test "$(echo "$VERSION_ID >= 22" | bc)" -ne 0; then
            yumdnf="dnf"
        fi
        centosDocker
        ;;
    *)
        exit 1
        ;;
    esac
    dockerPull
  fi
}

ubuntuDocker(){
    sudo apt-get update -qq
    sudo apt-get -y install apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL http://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] http://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable"
    sudo apt-get -y update
    # 查找Docker-CE的版本:
    # apt-cache madison docker-ce
    # sudo apt-get -y install docker-ce=[VERSION]
    sudo apt-get -y install docker-ce
    sudo tee /etc/docker/daemon.json <<-'EOF'
    {
    "registry-mirrors": ["http://2743e10c.m.daocloud.io"]
    }
EOF
    sudo systemctl daemon-reload
    sudo systemctl restart docker

    apt-get install unzip
}

centosDocker() {
    sudo yum install -y yum-utils device-mapper-persistent-data lvm2
    sudo yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
    sudo yum makecache fast
    # 查找Docker-CE的版本:
    # yum list docker-ce.x86_64 --showduplicates | sort -r
    # sudo yum -y install docker-ce-[VERSION]
    sudo yum -y install docker-ce
    sudo service docker start

    yum install unzip
}

dockerPull() {
  echo "===> Pulling fabric Images"
  dockerFabricPull ${FABRIC_TAG}
  echo "===> Pulling fabric ca Image"
  dockerCaPull ${CA_TAG}
  echo "===> Pulling thirdparty docker images"
  dockerThirdPartyImagesPull ${THIRDPARTY_TAG}
  echo
  echo "===> List out all docker images"
  docker images
}

dockerFabricPull() {
  for IMAGES in peer orderer ccenv; do
      echo "==> FABRIC IMAGE: $IMAGES"
      echo
      docker pull hyperledger/fabric-$IMAGES:$FABRIC_TAG
      docker tag hyperledger/fabric-$IMAGES:$FABRIC_TAG hyperledger/fabric-$IMAGES
  done
}

dockerCaPull() {
  echo "==> FABRIC CA IMAGE"
  echo
  docker pull hyperledger/fabric-ca:$CA_TAG
  docker tag hyperledger/fabric-ca:$CA_TAG hyperledger/fabric-ca
}

dockerThirdPartyImagesPull() {
  for IMAGES in couchdb kafka zookeeper; do
      echo "==> THIRDPARTY DOCKER IMAGE: $IMAGES"
      echo
      docker pull hyperledger/fabric-$IMAGES:$THIRDPARTY_TAG
      docker tag hyperledger/fabric-$IMAGES:$THIRDPARTY_TAG hyperledger/fabric-$IMAGES
  done

  local CONSUL_TAG=1.4
  local CADVISOR_TAG=v0.32.0
  local FILEBEAT_TAG=6.5.4

  docker pull consul:$CONSUL_TAG
  docker tag consul:$CONSUL_TAG consul
  docker pull google/cadvisor:$CADVISOR_TAG
  docker tag google/cadvisor:$CADVISOR_TAG google/cadvisor
  docker pull zhigui/filebeat:$FILEBEAT_TAG
  docker tag zhigui/filebeat:$FILEBEAT_TAG zhigui/filebeat
}

dockerInstall