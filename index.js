
const package = require('./package.json')
const fs = require("fs")
const http = require("https")
const request = require("request")

var silent = false;

var program = require('commander')
program
	.version(package.version)
	.option('-h, --host <host>', 'target hostname', process.env.EZHOST || 'https://ezcp.io')
	.option("-s, --silent", "silent mode", false)

isStatusOK = (statuscode) => {
	return (200 <= statuscode && statuscode < 300)
}

isSHA1Token = (token) => {
	return token.match(/^[0-9a-f]{40}$/) != null
}

upload = (filestream, token) => {
	filestream.pipe(request.post(`${program.host}/upload/${token}`, (err, res, body) => {
		if (err) {
			console.error("ezcp upload:", err)
			process.exit(1)
		}
		else if (!isStatusOK(res.statusCode)) {
			console.error("ezcp upload status:", res.statusCode)
			process.exit(1)
		}
		else process.exit(0)
	}))
}

download = (filestream, token) => {
	request.get(`${program.host}/download/${token}`)
		.on('response', (res) => {
			if (!isStatusOK(res.statusCode)) {
				console.error("ezcp download status:", res.statusCode)
				process.exit(1)
			}
		})
		.on('error', (err) => {
			console.error("ezcp download:", err)
			process.exit(1)
		})
		.pipe(filestream)
}

gettoken = () => {
	request.post(`${program.host}/token`, (err, res, body) => {
		if (err) {
			console.log("ezcp token:", err)
		} else if (!isStatusOK(res.statusCode)) {
			console.error("ezcp token status:", res.statusCode)
		} else if (body) {
			console.log(body)
		} else {
			console.error("ezcp token invalid")
		}
	})
}

program.parse(process.argv)

if (program.args.Command == null) {
	if (!program.args.length) {
		gettoken()
	} else if (program.args.length == 1) {
		if (process.stdin.isTTY) {
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
			fstream.on("error" , (err) => console.error("destination path error:", err))
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
}
