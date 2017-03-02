
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

upload = (filestream, token) => {
	const purl = `${program.host}/upload/${token}`
	filestream.pipe(request.post(purl, (err, res, body) => {
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
	const durl = `${program.host}/download/${token}`
	request(durl)
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
	const turl = `${program.host}/`
	request.get(turl, (err, res, body) => {
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
			download(process.stdout, token)
		} else {
			const token = program.args[0]
			process.stdin.resume()
			upload(process.stdin, token)
		}
	} else if (program.args.length == 2) {
		fs.access(program.args[0], fs.R_OK, (err) => {
			if (err) {
				const fpath = program.args[1]
				const token = program.args[0]
				const fstream = fs.createWriteStream(fpath)
				fstream.on("destination path error:", (err) => console.error(err))
				download(fstream, token)
			} else {
				const fpath = program.args[0]
				const token = program.args[1]
				const fstream = fs.createReadStream(fpath)
				upload(fstream, token)
			}
		})
	}
}
