const { 
    Client, PrivateKey, AccountId,
    ContractCreateTransaction, ContractFunctionParameters,
    FileCreateTransaction, FileAppendTransaction } = require("@hashgraph/sdk");
require("dotenv").config();

string_chop =  function(str, size){
    if (str == null) return [];
    str = String(str);
    size = ~~size;
return size > 0 ? str.match(new RegExp('.{1,' + size + '}', 'g')) : [str];
}

async function main() {

//Grab your Hedera testnet account ID and private key from your .env file
const myAccountId = //AccountId.fromString(
    process.env.MY_ACCOUNT_ID;
const myPrivateKey = //PrivateKey.fromString(
    process.env.MY_PRIVATE_KEY;

// If we weren't able to grab it, we should throw a new error
if (myAccountId == null ||
    myPrivateKey == null ) {
    throw new Error("Environment variables myAccountId and myPrivateKey must be present");
}

// Create our connection to the Hedera network
// The Hedera JS SDK makes this really easy!
const client = Client.forTestnet();

client.setOperator(myAccountId, myPrivateKey);

/*
TO-DO deploy daoToken, timelock and governor contracts and excecute functions

console.log("Deploy Timelock contract");
let Timelock = require("../artifacts/solidity/Governance/Timelock.sol/Timelock.json");
let bytecode = Timelock.bytecode;
let fnParameters = new ContractFunctionParameters()
    .addAddress(process.env.PUBLIC_EVM_ADDRESS)
    .addUint256(172800);

timelockAddress = await createContract(bytecode,client,myPrivateKey,fnParameters);

*/

console.log("Deploy NetEmissionsTokenNetwork contract");
let NetEmissionsTokens = require("../artifacts/solidity/NetEmissionsTokenNetwork.sol/NetEmissionsTokenNetwork.json");
let bytecode = NetEmissionsTokens.bytecode;
let netAddress;
let fnParameters = new ContractFunctionParameters().addAddress(process.env.PUBLIC_EVM_ADDRESS);
netAddress = await createContract(bytecode,client,myPrivateKey,fnParameters);

//if(process.env.NET_ADDRESS){netAddress=process.env.NET_ADDRESS;}

console.log("Deploy CarbonTracker contract");
let CarbonTracker = require("../artifacts/solidity/CarbonTracker.sol/CarbonTracker.json");
bytecode = CarbonTracker.bytecode;

fnParameters = new ContractFunctionParameters()
    .addAddress(process.env.PUBLIC_EVM_ADDRESS)
    .addAddress(netAddress);
console.log(fnParameters) 
await createContract(bytecode,client,myPrivateKey,fnParameters);

}

async function createContract(bytecode, client, myPrivateKey,fnParameters){
    // Hedera files have a limit of 6 KB so we must chop the bytecode down 
    bytecode_arr = string_chop(bytecode,5000);
    chunks = bytecode_arr.length;

    //Create a file on Hedera and store the hex-encoded bytecode
    // must set the array of keys which have access to the file or the Append later will get UNAUTHORIZED error
    const fileCreateTx = new FileCreateTransaction()
        .setKeys([PrivateKey.fromString(myPrivateKey)])
        .setContents(bytecode_arr[0]);


    //Submit the file to the Hedera test network signing with the transaction fee payer key specified with the client
    const submitTx = await fileCreateTx.execute(client);

    //Get the receipt of the file create transaction
    const fileReceipt = await submitTx.getReceipt(client);

    //Get the file ID from the receipt
    const bytecodeFileId = fileReceipt.fileId;

    //Log the file ID
    console.log("Chunk 0 added.  The smart contract bytecode file ID is " +bytecodeFileId);

    // now append all the chunks of the bytecode
    for (let i = 1; i < chunks; i++) {
        console.log("Processing chunk " + i);
        // append the next chunk.  Must use freezeWith or will get a "transaction must have been frozen before calculating the hash will be stable" error
        const fileAppendTx = new FileAppendTransaction()
            .setFileId(bytecodeFileId)
            .setContents(bytecode_arr[i])
            .freezeWith(client);
        // sign with one of the keys from FileCreateTransaction.setKeys    
        fileAppendTx.sign(PrivateKey.fromString(myPrivateKey));
        const appendTx = await fileAppendTx.execute(client);
        const appendReceipt = await appendTx.getReceipt(client);
        console.log("Chunk " + i + " appended with status " + appendReceipt.status.toString());
    }
    //Deploy the contract instance
    const contractTx = await new ContractCreateTransaction()
        //The bytecode file ID
        .setBytecodeFileId(bytecodeFileId)
        //The max gas to reserve
        .setGas(2000000)
        //Provide the constructor parameters for the contract
        .setConstructorParameters(fnParameters)
    ;

    //Submit the transaction to the Hedera test network
    const contractResponse = await contractTx.execute(client);

    //Get the receipt of the file create transaction
    const contractReceipt = await contractResponse.getReceipt(client);

    //Get the smart contract ID
    const newContractId = contractReceipt.contractId;

    const newContractAddress = newContractId.toSolidityAddress();

    //Log the smart contract ID
    console.log("The smart contract ID is " + newContractId);
    console.log("The smart contract Solidity address is " + newContractAddress);
    return newContractAddress;
}
main();