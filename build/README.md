# Dependency services

## components (mongodb, configtxlator)
```
cd components
docker-compose up -d
```

## coredns
dns service
```
cd coredns
docker-compose up -d
```
Note: 53/tcp、53/udp must open!

## efk
log query service
```
cd efk
docker-compose up -d
```

## monitoring
```
cd monitoring

modify `external-ip` to real ip address

docker-compose up -d
```



