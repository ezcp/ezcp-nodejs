
const package = require('./package.json')
const fs = require("fs")
const request = require("request")
const os = require("os")
const crypto = require('crypto')
const Transform = require('stream').Transform;
const program = require('commander')

program
	.version(package.version)
	.option("-b, --bitcoin", "return a bitcoin address for registration")
	.option("-x, --passphrase <passphrase>", "encrypt / decrypt file")
	.option("-l, --login <txid>", "register user and set a durable token")
	.parse(process.argv)

program.on('--help', ()=>{
	console.log("  Premium usage:\n")
	console.log("    ezcp --bitcoin                   get address for paiement")
	console.log("    ezcp --login <transactionId>     retreive a token and store it")
	console.log("    ezcp <filepath>                  if <filepath> exists, upload the file using the previously stored token")
	console.log("                                     if <filepath> doesn't exist, download the file pointed by previously stored token")

	console.log("\n  Free usage:\n")
	console.log("    ezcp <filepath> <token>          upload the file using a free token get thanks to the website http://ezcp.io")
	console.log("    ezcp <token> <filepath>          download the file pointed by the token ")

	console.log("\n  More usage:\n")
	console.log("    cat <file> | ezcp               upload the piped file")
	console.log("    ezcp > file                     download the file to the redirected pipe ")
	console.log('    ezcp -x "pass phrase" <file>    upload/download the file with encryption')

});

const algorithm = 'aes-256-ctr'
var encrypt = null
var decrypt = null

if (program.passphrase) {
	encrypt = crypto.createCipher(algorithm, program.passphrase)
	decrypt = crypto.createDecipher(algorithm, program.passphrase)
} else {
	// create identity transform
	encrypt = new Transform({ transform(chunk, encoding, callback) {callback(null, chunk) }});
	decrypt = new Transform({ transform(chunk, encoding, callback) {callback(null, chunk) }});
}

/*
 * core methods
 */

isStatusOK = (statuscode) => {
	return (200 <= statuscode && statuscode < 300)
}

isSHA1Token = (token) => {
	return token.match(/^[0-9a-f]{40}$/) != null
}

getDurableToken = () => {
	try {
		return  fs.readFileSync(os.homedir()+"/.ezcp-token")
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
		return ""
	}
}

upload = (filestream, token) => {
	filestream.pipe(encrypt).pipe(
		request.post(`https://ezcp.io/upload/${token}`)
		.on('response', (res) => {
			if (!isStatusOK(res.statusCode)) {
				console.error("ezcp upload status:", res.statusCode, body)
				process.exit(1)
			}
		})
		.on('error', (err) => {
			console.error("ezcp upload:", err)
			process.exit(1)
		})
	)
	.on('error', (err) => console.error("ezcp upload:", err))
}

download = (filestream, token) => {
	request.get(`https://ezcp.io/download/${token}`)
	.on('response', (res) => {
		if (!isStatusOK(res.statusCode)) {
			console.error("ezcp download status:", res.statusCode, body)
			process.exit(1)
		}
	})
	.on('error', (err) => {
		console.error("ezcp download:", err)
		process.exit(1)
	})
	.pipe(decrypt).on('erorr' , (err)=> console.error(err))
	.pipe(filestream)
}

gettoken = () => {
	request.post(`https://ezcp.io/token/${program.login}`, (err, res, body) => {
		if (err) {
			console.log("ezcp login:", err)
		} else if (!isStatusOK(res.statusCode)) {
			console.error("ezcp login status:", res.statusCode, body)
		} else if (body) {
			fs.writeFileSync(os.homedir() + "/.ezcp-token", body)
			console.log(body)
		} else {
			console.error("ezcp invalid login")
		}
	})
}

getBitcoinAddr = () => {
	fs.readFile(`${os.homedir()}/.ezcp-bitcoin`, (err, bitcoinAddress)=>{
		if (err || !bitcoinAddress) {
			request.post(`https://ezcp.io/bitcoin`, (err, res, body) => {
				if (err) {
					console.log("ezcp bitcoin:", err)
				} else if (!isStatusOK(res.statusCode)) {
					console.error("ezcp bitcoin status:", res.statusCode, body)
				} else if (body) {
					console.log("Please make your 0.01 BTC paiement to: "+body)
					fs.writeFileSync(`${os.homedir()}/.ezcp-bitcoin`, body)
				} else {
					console.error("ezcp bitcoin unknown err")
				}
			})
		} else {
			console.log("Please make your 0.01 BTC paiement to: "+bitcoinAddress)
		}
	})
}

/*
 * command line parsing
 */

if (program.bitcoin) {
	getBitcoinAddr()
} else if (!program.args.length) {
	if (program.login) {
		gettoken()
	} else if (process.stdin.isTTY && process.stdout.isTTY) {
		program.help()
	} else if (process.stdin.isTTY) {
		// download piped
		var token = getDurableToken()
		if (token)
			download(process.stdout, token)
		else 
			console.error("You have to login first!")
	} else if (process.stdout.isTTY) {
		// upload piped
		var token = getDurableToken()
		if (token)
			upload(process.stdin, token)
		else
			console.error("You have to login first!")				
	}
} else if (program.args.length == 1) {
	var durableToken = getDurableToken()
	if (process.stdin.isTTY && process.stdout.isTTY && durableToken) {
		// registered user shortcut
		const fpath = program.args[0]
		fs.stat(fpath, (err, stats)=>{
			if (stats && stats.isFile) {
				// upload mode
				const fstream = fs.createReadStream(fpath)
				upload(fstream, durableToken)
			} else {
				// download mode
				const fstream = fs.createWriteStream(fpath)
				download(fstream, durableToken)
			}
		})
	} else if (process.stdin.isTTY) {
		const token = program.args[0]
		if(isSHA1Token(token))
			download(process.stdout, token)
		else 
			console.error(`${token} is not a valid token`)
	} else {
		const token = program.args[0]
		if(isSHA1Token(token)) {
			process.stdin.resume()
			upload(process.stdin, token)
		}
		else 
			console.error(`${token} is not a valid token`)
	}
} else if (program.args.length == 2) {
	const arg0 = program.args[0]
	const arg1 = program.args[1]
	if (isSHA1Token(arg0) && !isSHA1Token(arg1)) {
		const fpath = arg1
		const token = arg0
		const fstream = fs.createWriteStream(fpath)
		download(fstream, token)
	} else if(!isSHA1Token(arg0) && isSHA1Token(arg1)) {
		const fpath = arg0
		const token = arg1
		const fstream = fs.createReadStream(fpath)
		upload(fstream, token)
	} else {
		console.error("token not found")
	}
}

