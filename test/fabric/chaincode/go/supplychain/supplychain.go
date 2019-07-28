/**
 * One chain code and multiple smart contracts
 * File and OriginInvoice operations
 * Interface definitions

type FileAsset interface {
	Store(uid string,fileName string, digest string, owner string) pb.Response
	Query(uid string, owner string) pb.Response
	Source(uid string, amount string, payDate string, seller string, buyer string, fileUid string) pb.Response
}

type InvoiceAsset interface {
	CreateInvoice(uid string, amount string, holder string) pb.Response
	Transfer(uid string, holder string) pb.Response
	Divide(originalUid string,uid string, amount string, holder string) pb.Response
	Mortgage(uid string) pb.Response
	Close(uid string) pb.Response
}

 *
*/

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"strconv"
	"strings"
)

const (
	tableSuffix                     = "uid"
	keyDelimiter                    = "~"
	tableFile                       = "file"
	tableOriginInvoice              = "origin_invoice"
	tableDerivedInvoice             = "derived_invoice"
	tableFileCompositeKey           = tableFile + keyDelimiter + tableSuffix
	tableOriginInvoiceCompositeKey  = tableOriginInvoice + keyDelimiter + tableSuffix
	tableDerivedInvoiceCompositeKey = tableDerivedInvoice + keyDelimiter + tableSuffix
	statusCreated                   = "created"
	statusTransfered                = "transfer"
	statusMortgaged                 = "mortgaged"
	statusClosed                    = "closed"
)

type File struct {
	uid      string
	fileName string
	digest   string
	owner    string
}

//从文件导入的数据
type OriginInvoice struct {
	uid     string
	amount  string
	payDate string
	seller  string
	buyer   string
	fileUid string
}

//通过Razzil创建的Invoice
type DerivedInvoice struct {
	uid              string
	sourceUid        string
	amount           string
	balance          string
	status           string
	holder           string
	originInvoiceUid string
}

type SupplyChain struct {
}

func (supplyChain *SupplyChain) Init(stub shim.ChaincodeStubInterface) pb.Response {
	// add the initialization logic and process
	return shim.Success(nil)
}

func (supplyChain *SupplyChain) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	// dispatch the function invocation to different methods
	function, args := stub.GetFunctionAndParameters()

	if args == nil {
		return shim.Error("Invalid function parameters.")
	}

	if function == "store" {
		return supplyChain.Store(args, stub)
	} else if function == "query" {
		return supplyChain.Store(args, stub)
	} else if function == "source" {
		return supplyChain.Source(args, stub)
	} else if function == "createInvoice" {
		return supplyChain.CreateInvoice(args, stub)
	} else if function == "transferInvoice" {
		return supplyChain.Transfer(args, stub)
		/*} else if function == "divideInvoice" {
		return supplyChain.Divide(args, stub)*/
	} else if function == "mortgageInvoice" {
		return supplyChain.Mortgage(args, stub)
	} else if function == "closeInvoice" {
		return supplyChain.Close(args, stub)
	}

	return shim.Error("Invalid function name.")
}

func (supplyChain *SupplyChain) Store(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	file := new(File)
	file.uid = args[0]
	file.fileName = args[1]
	file.digest = args[2]
	file.owner = args[3]

	compositeKey, err := stub.CreateCompositeKey(tableFileCompositeKey, []string{tableFile, file.uid})

	if err != nil {
		return shim.Error(err.Error())
	}

	jsonValue, err := json.Marshal(file)
	if err != nil {
		return shim.Error(err.Error())
	}

	errState := stub.PutState(compositeKey, jsonValue)
	if errState != nil {
		return shim.Error(errState.Error())
	}
	return shim.Success(jsonValue)
}

func (supplyChain *SupplyChain) Query(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	uid := args[0]
	compositeKey, err := stub.CreateCompositeKey(tableFileCompositeKey, []string{tableFile, uid})
	if err != nil {
		return shim.Error(err.Error())
	}
	jsonValue, err := stub.GetState(compositeKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(jsonValue)
}

func (supplyChain *SupplyChain) Source(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	invoice := new(OriginInvoice)
	invoice.uid = args[0]
	invoice.amount = args[1]
	invoice.payDate = args[2]
	invoice.seller = args[3]
	invoice.buyer = args[4]
	invoice.fileUid = args[5]

	compositeKey, err := stub.CreateCompositeKey(tableOriginInvoiceCompositeKey, []string{tableOriginInvoice, invoice.uid})
	if err != nil {
		return shim.Error(err.Error())
	}
	jsonValue, err := json.Marshal(invoice)
	if err != nil {
		return shim.Error(err.Error())
	}
	errState := stub.PutState(compositeKey, jsonValue)
	if errState != nil {
		return shim.Error(errState.Error())
	}
	return shim.Success(jsonValue)
}

func (supplyChain *SupplyChain) CreateInvoice(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	if len(args) != 4 {
		return shim.Error(fmt.Sprintf("Invalid number of parameters, expecting 4, but got: %d", len(args)))
	}

	derivedInvoice := &DerivedInvoice{
		uid:              args[0],
		sourceUid:        "", //When core enterprise create invoice, it has no source invoice
		amount:           args[1],
		holder:           args[2],
		balance:          args[1], //Currently balance always equals amount
		originInvoiceUid: args[3], //Currently always empty
		status:           statusCreated,
	}

	var compositeKey string
	var err error

	// Currently doesn't check the origin invoice
	/*if err = supplyChain.checkOriginInvoice(derivedInvoice.originInvoiceUid, stub); err != nil {
		return shim.Error(err.Error())
	}
	*/

	if compositeKey, err = stub.CreateCompositeKey(tableDerivedInvoiceCompositeKey, []string{tableDerivedInvoice, derivedInvoice.uid}); err != nil {
		return shim.Error(err.Error())
	}
	var derivedInvoiceBytes []byte
	if derivedInvoiceBytes, err = json.Marshal(derivedInvoice); err != nil {
		return shim.Error(err.Error())
	}
	if err = stub.PutState(compositeKey, derivedInvoiceBytes); err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(derivedInvoiceBytes)
}

func (supplyChain *SupplyChain) checkOriginInvoice(originInvoiceUid string, stub shim.ChaincodeStubInterface) error {
	var invoiceCompositeKey string
	var err error
	if invoiceCompositeKey, err = stub.CreateCompositeKey(tableOriginInvoiceCompositeKey, []string{tableOriginInvoice, originInvoiceUid}); err != nil {
		fmt.Printf("createCompositeKey failed with err: %s", err.Error())
		return errors.New(err.Error())
	}

	var existInvoiceRecord []byte
	if existInvoiceRecord, err = stub.GetState(invoiceCompositeKey); err != nil {
		fmt.Printf("GetState failed with key: %s err: %s", invoiceCompositeKey, err.Error())
		return errors.New(err.Error())
	}
	if existInvoiceRecord == nil {
		fmt.Printf("Origin invoice data does not exist : %s", originInvoiceUid)
		return errors.New(fmt.Sprintf("Origin invoice data does not exist : %s", originInvoiceUid))
	}

	return nil
}

func (supplyChain *SupplyChain) Transfer(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	if len(args) != 5 {
		return shim.Error(fmt.Sprintf("Invalid number of parameters, expecting 5, but got: %d", len(args)))
	}

	derivedInvoice := &DerivedInvoice{
		uid:              args[0],
		sourceUid:        args[1],
		amount:           args[2],
		holder:           args[3],
		balance:          args[1], //Currently balance always equals amount
		originInvoiceUid: args[4], //Currently always empty
		status:           statusTransfered,
	}

	var compositeKey string
	var err error
	if compositeKey, err = stub.CreateCompositeKey(tableDerivedInvoiceCompositeKey, []string{tableDerivedInvoice, derivedInvoice.uid}); err != nil {
		return shim.Error(err.Error())
	}
	var derivedInvoiceBytes []byte
	if derivedInvoiceBytes, err = stub.GetState(compositeKey); err != nil {
		return shim.Error(err.Error())
	}

	if derivedInvoiceBytes != nil {
		return shim.Error(fmt.Sprintf("Derived invoice already exist: %s", derivedInvoice.uid))
	}

	if derivedInvoiceBytes, err = json.Marshal(derivedInvoice); err != nil {
		return shim.Error(err.Error())
	}
	if err = stub.PutState(compositeKey, derivedInvoiceBytes); err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(derivedInvoiceBytes)
}

func (supplyChain *SupplyChain) Divide(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	if len(args) != 5 {
		return shim.Error(fmt.Sprintf("Invalid number of parameters, expecting 5, but got: %d", len(args)))
	}

	oldUid := args[0]
	newDerivedInvoice := new(DerivedInvoice)
	newDerivedInvoice.uid = args[1]
	newDerivedInvoice.amount = args[2]
	newDerivedInvoice.holder = args[3]
	newDerivedInvoice.originInvoiceUid = args[4]

	var compositeKey string
	var err error
	if compositeKey, err = stub.CreateCompositeKey(tableDerivedInvoiceCompositeKey, []string{tableDerivedInvoice, oldUid}); err != nil {
		return shim.Error(err.Error())
	}

	var oldDerivedInvoiceBytes []byte
	if oldDerivedInvoiceBytes, err = stub.GetState(compositeKey); err != nil {
		return shim.Error(err.Error())
	}
	if oldDerivedInvoiceBytes == nil {
		return shim.Error(fmt.Sprintf("Origin derived invoice does not exist: %s", oldUid))
	}

	oldDerivedInvoice := new(DerivedInvoice)
	if err = json.Unmarshal(oldDerivedInvoiceBytes, oldDerivedInvoice); err != nil {
		return shim.Error(err.Error())
	}

	//todo: how to handle decimal type in go
	var amount int
	if amount, err = strconv.Atoi(oldDerivedInvoice.amount); err != nil {
		return shim.Error(err.Error())
	}
	var dividedAmount int
	if dividedAmount, err = strconv.Atoi(newDerivedInvoice.amount); err != nil {
		return shim.Error(err.Error())
	}
	oldDerivedInvoice.balance = strconv.Itoa(amount - dividedAmount)

	derivedCompositeKey, err := stub.CreateCompositeKey(tableDerivedInvoiceCompositeKey, []string{tableDerivedInvoice, newDerivedInvoice.uid})
	if err != nil {
		return shim.Error(err.Error())
	}
	jsonValue, err := json.Marshal(newDerivedInvoice)
	if err != nil {
		return shim.Error(err.Error())
	}
	if err = stub.PutState(derivedCompositeKey, jsonValue); err != nil {
		return shim.Error(err.Error())
	}

	origValue, err := json.Marshal(oldDerivedInvoice)
	if err != nil {
		return shim.Error(err.Error())
	}
	if err = stub.PutState(compositeKey, origValue); err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(origValue)
}

func (supplyChain *SupplyChain) Mortgage(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	if len(args) != 5 {
		return shim.Error(fmt.Sprintf("Invalid number of parameters, expecting 5, but got: %d", len(args)))
	}

	derivedInvoice := &DerivedInvoice{
		uid:              args[0],
		sourceUid:        args[1],
		amount:           args[2],
		holder:           args[3],
		balance:          args[1], //Currently balance always equals amount
		originInvoiceUid: args[4], //Currently always empty
		status:           statusMortgaged,
	}

	var compositeKey string
	var err error
	if compositeKey, err = stub.CreateCompositeKey(tableDerivedInvoiceCompositeKey, []string{tableDerivedInvoice, derivedInvoice.uid}); err != nil {
		return shim.Error(err.Error())
	}

	var derivedInvoiceBytes []byte
	if derivedInvoiceBytes, err = stub.GetState(compositeKey); err != nil {
		return shim.Error(err.Error())
	}

	if derivedInvoiceBytes != nil {
		return shim.Error(fmt.Sprintf("Derived inovice already exist: %s", derivedInvoice.uid))
	}

	if derivedInvoiceBytes, err = json.Marshal(derivedInvoice); err != nil {
		return shim.Error(err.Error())
	}

	if err = stub.PutState(compositeKey, derivedInvoiceBytes); err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(derivedInvoiceBytes)
}

func (supplyChain *SupplyChain) Close(args []string, stub shim.ChaincodeStubInterface) pb.Response {
	if len(args) != 1 {
		return shim.Error(fmt.Sprintf("Invalid number of parameters, expecting 1, but got: %d", len(args)))
	}

	uids := strings.Split(args[0], ",")
	successCount := 0
	for i := 0; i < len(uids); i++ {
		var compositeKey string
		var err error
		if compositeKey, err = stub.CreateCompositeKey(tableDerivedInvoiceCompositeKey, []string{tableDerivedInvoice, uids[i]}); err != nil {
			fmt.Printf("CreateCompositeKey failed with uid: %s, err: %s", uids[i], err.Error())
			continue
		}

		var derivedInvoiceBytes []byte
		if derivedInvoiceBytes, err = stub.GetState(compositeKey); err != nil {
			fmt.Printf("GetState failed with uid: %s, err: %s", uids[i], err.Error())
			continue
		}

		if derivedInvoiceBytes == nil {
			fmt.Printf("Derived invoice does not exist: %s", uids[i])
			continue
		}

		derivedInvoice := &DerivedInvoice{}

		if err = json.Unmarshal(derivedInvoiceBytes, derivedInvoice); err != nil {
			fmt.Printf("Unmarshal failed with uid: %s, err: %s", uids[i], err.Error())
		}

		derivedInvoice.status = statusClosed
		if derivedInvoiceBytes, err = json.Marshal(derivedInvoice); err != nil {
			fmt.Printf("Marshal failed with uid: %s, err: %s", uids[i], err.Error())
		}

		if err = stub.PutState(compositeKey, derivedInvoiceBytes); err != nil {
			fmt.Printf("PutState failed with uid: %s, err: %s", uids[i], err.Error())
		}

		successCount++
	}

	if successCount != len(uids) {
		return shim.Error(fmt.Sprintf("Failed to close invoice with uids: %s", uids))
	}
	return shim.Success(nil)
}

func main() {
	if err := shim.Start(new(SupplyChain)); err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}
