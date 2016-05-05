var express = require("express");
var app = express();
var async = require("async");

var fs = require("fs");

var Web3 = require('web3');


var grabBlocks = function(config) {
	
	var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:" + config.gethPort.toString()));
	setTimeout(function() {
		grabBlock(config, web3, config.start);
	}, 10000);
}


var grabBlock = function(config, web3, blockHash) {
	if(web3.isConnected()) {
		web3.eth.getBlock(blockHash, function(error, blockData) {
			if(error) {
				console.log("Error: Aborted due to error on getting block with hash: " +
					blockHash);
				console.log("Error Received: " + error);
				process.exit(9);
			}
			else {
				// Grab each of the block's transactions and add it to the blockData's 
				// transactions array before writing the blockData to the file
				if('transactions' in blockData && Array.isArray(blockData.transactions)) {

					// copy the transaction hashes and clear the transactions array 
					// (will now be an array an array of transaction objects rather 
				  // than just transaction hash strings)
					var txHashes = blockData.transactions.slice();
					blockData.transactions = [];
					async.forEachSeries(txHashes, function(txHash, callback) {
						web3.eth.getTransaction(txHash, function(error, transactionData) {
							blockData.transactions.push(transactionData);
							callback();
						});
					}, function(error) {

						if(!('quiet' in config && config.quiet === true)) {
							console.log("got all " + (blockData.transactions.length) + 
								" transactions for block: " + blockData.hash);
						}

						// write the block info to a json file
						writeBlockToFile(config, blockData);
						if('parentHash' in blockData) {
							grabBlock(config, web3, blockData.parentHash);
						}
					});
				}
				else {
					writeBlockToFile(config, blockData);
					if('parentHash' in blockData) {
						grabBlock(config, web3, blockData.parentHash);
					}
				}
			}
		});
	}
	else {
		console.log("Error: Aborted due to web3 is not connected when trying to " +
			"get block with hash: " + blockHash);
		process.exit(9);
	}
}


var writeBlockToFile = function(config, blockData) {
	var blockFilename = blockData.hash + ".json";
	var fileContents = JSON.stringify(blockData, null, 4);

	// TODO: write the blockData to the file
	fs.writeFile(config.output + "/" + blockFilename, fileContents, function(error) {
		if(error) {
			console.log("Error: Aborted due to error on writting to file for block number " +
				blockData.number.toString() + ": '" + config.output + "/" +
				blockFilename + "'");
			console.log("Error Received: " + error);
			process.exit(9);

			return console.log(error);
		}
		else {
			if(!('quiet' in config && config.quiet === true)) {
				console.log("File successfully written for block number " +
					blockData.number.toString() + ": '" + config.output + "/" +
					blockFilename + "'");
			}
		}
	});
}


/** On Startup **/
// start geth with: geth --rpc --rpccorsdomain "http://localhost:8000"
// read input arguments
// possible args: 
//		output (output directory, this directory if not provided)
//		gethPort (geth port on local host (optional, defult = 8545))

var config = {};

try {
	var configContents = fs.readFileSync("config.json");
	config = JSON.parse(configContents);
}
catch (error) {
	if (error.code === 'ENOENT') {
		console.log('No config file found. Using default configuration.');
	}
	else {
		throw error;
	}
}

// set the default geth port if it's not provided
if(!('gethPort' in config) || (typeof config.gethPort) != "number") {
    config.gethPort = 8545; // default
}

// set the default output directory if it's not provided
if(!('output' in config) || (typeof config.output) != "string") {
    config.output = "."; // default this directory
}

// set the default start block if it's not provided
if(!('start' in config) || (typeof config.start) != "string") {
    config.start = "latest"; // default this directory
}


console.log("Using configuration:");
console.log(config);
grabBlocks(config);

app.listen(4000);