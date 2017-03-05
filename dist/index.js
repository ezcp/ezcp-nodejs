"use strict";

var packageInfo = require('../package.json');
var fs = require("fs");
var request = require("request");
var os = require("os");
var crypto = require('crypto');
var program = require('commander');

program.version(packageInfo.version).option("-b, --bitcoin", "return a bitcoin address for registration").option("-x, --passphrase <passphrase>", "encrypt / decrypt file").option("-l, --login <txid>", "register user and set a durable token").parse(process.argv);

program.on('--help', function () {
	console.log("  Premium usage:\n");
	console.log("    ezcp --bitcoin                   get address for paiement");
	console.log("    ezcp --login <transactionId>     retreive a token and store it");
	console.log("    ezcp <filepath>                  if <filepath> exists, upload the file using the previously stored token");
	console.log("                                     if <filepath> doesn't exist, download the file pointed by previously stored token");

	console.log("\n  Free usage:\n");
	console.log("    ezcp <filepath> <token>          upload the file using a free token get thanks to the website http://ezcp.io");
	console.log("    ezcp <token> <filepath>          download the file pointed by the token ");

	console.log("\n  More usage:\n");
	console.log("    cat <file> | ezcp               upload the piped file");
	console.log("    ezcp > file                     download the file to the redirected pipe ");
	console.log('    ezcp -x "pass phrase" <file>    upload/download the file with encryption');
});

var algorithm = 'aes-256-ctr';
var encrypt = null;
var decrypt = null;

if (program.passphrase) {
	encrypt = crypto.createCipher(algorithm, program.passphrase);
	decrypt = crypto.createDecipher(algorithm, program.passphrase);
} else {
	var Stream = require('stream');
	encrypt = new Stream.PassThrough();
	decrypt = new Stream.PassThrough();
}

/*
 * core methods
 */

function homedir() {
	if (Number(process.versions.node.split('.')[0]) < 6) return process.env.HOME || process.env.USERPROFILE;else return os.homedir();
}

function urlFromToken(route, token) {
	return "https://api" + token[0].toString() + ".ezcp.io/" + route + "/" + token;
}

function isStatusOK(statuscode) {
	return 200 <= statuscode && statuscode < 300;
}

function isSHA1Token(token) {
	return token.match(/^[0-9a-f]{40}$/) != null;
}

function getDurableToken() {
	try {
		return fs.readFileSync(homedir() + "/.ezcp-token").toString();
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
		return null;
	}
}

function upload(filestream, token) {
	filestream.pipe(encrypt).pipe(request.post(urlFromToken("upload", token)).on('response', function (res) {
		if (!isStatusOK(res.statusCode)) {
			console.error("ezcp upload status:", res.statusCode, body);
			process.exit(1);
		}
	}).on('error', function (err) {
		console.error("ezcp upload:", err);
		process.exit(1);
	})).on('error', function (err) {
		return console.error("ezcp upload:", err);
	});
}

function download(filestream, token) {
	request.get(urlFromToken("download", token)).on('response', function (res) {
		if (!isStatusOK(res.statusCode)) {
			console.error("ezcp download status:", res.statusCode, body);
			process.exit(1);
		}
	}).on('error', function (err) {
		console.error("ezcp download:", err);
		process.exit(1);
	}).pipe(decrypt).on('erorr', function (err) {
		return console.error(err);
	}).pipe(filestream);
}

function gettoken() {
	request.post("https://ezcp.io/token/" + program.login, function (err, res, body) {
		if (err) {
			console.log("ezcp login:", err);
		} else if (!isStatusOK(res.statusCode)) {
			console.error("ezcp login status:", res.statusCode, body);
		} else if (body) {
			fs.writeFileSync(homedir() + "/.ezcp-token", body);
			console.log("Here's your permanent token: " + body);
		} else {
			console.error("ezcp invalid login");
		}
	});
}

function getBitcoinAddr() {
	fs.readFile(homedir() + "/.ezcp-bitcoin", function (err, bitcoinAddress) {
		if (err || !bitcoinAddress) {
			request.post("https://ezcp.io/bitcoin", function (err, res, body) {
				if (err) {
					console.log("ezcp bitcoin:", err);
				} else if (!isStatusOK(res.statusCode)) {
					console.error("ezcp bitcoin status:", res.statusCode, body);
				} else if (body) {
					console.log("Please make your 0.01 BTC paiement to: " + body);
					fs.writeFileSync(homedir() + "/.ezcp-bitcoin", body);
				} else {
					console.error("ezcp bitcoin unknown err");
				}
			});
		} else {
			console.log("Please make your 0.01 BTC paiement to: " + bitcoinAddress);
		}
	});
}

/*
 * command line parsing
 */

if (program.bitcoin) {
	getBitcoinAddr();
} else if (!program.args.length) {
	if (program.login) {
		gettoken();
	} else if (process.stdin.isTTY && process.stdout.isTTY) {
		program.help();
	} else if (process.stdin.isTTY) {
		// download piped
		var token = getDurableToken();
		if (token) download(process.stdout, token);else console.error("You have to login first!");
	} else if (process.stdout.isTTY) {
		// upload piped
		var token = getDurableToken();
		if (token) upload(process.stdin, token);else console.error("You have to login first!");
	}
} else if (program.args.length == 1) {
	var durableToken = getDurableToken();
	if (process.stdin.isTTY && process.stdout.isTTY && durableToken) {
		// registered user shortcut
		var fpath = program.args[0];
		fs.stat(fpath, function (err, stats) {
			if (stats && stats.isFile) {
				// upload mode
				var fstream = fs.createReadStream(fpath);
				upload(fstream, durableToken);
			} else {
				// download mode
				var _fstream = fs.createWriteStream(fpath);
				download(_fstream, durableToken);
			}
		});
	} else if (process.stdin.isTTY) {
		var _token = program.args[0];
		if (isSHA1Token(_token)) download(process.stdout, _token);else console.error(_token + " is not a valid token");
	} else {
		var _token2 = program.args[0];
		if (isSHA1Token(_token2)) {
			process.stdin.resume();
			upload(process.stdin, _token2);
		} else console.error(_token2 + " is not a valid token");
	}
} else if (program.args.length == 2) {
	var arg0 = program.args[0];
	var arg1 = program.args[1];
	if (isSHA1Token(arg0) && !isSHA1Token(arg1)) {
		var _fpath = arg1;
		var _token3 = arg0;
		var fstream = fs.createWriteStream(_fpath);
		download(fstream, _token3);
	} else if (!isSHA1Token(arg0) && isSHA1Token(arg1)) {
		var _fpath2 = arg0;
		var _token4 = arg1;
		var _fstream2 = fs.createReadStream(_fpath2);
		upload(_fstream2, _token4);
	} else {
		console.error("token not found");
	}
}