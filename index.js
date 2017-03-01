
const package = require('./package.json')
const fs = require("fs")
const http = require("https")
const request = require("request")

var silent = false;


upload = (filestream, token) => {
	const purl = `${program.host}:${program.port}/upload/${token}`
	filestream.pipe(request.post(purl, (err, res, body) => {
		if (err) process.exit(1)
		if (!silent) console.log(res.statusCode)
		process.exit(0)
	}))
}

download = (filestream, token) => {
	const durl = `${program.host}:${program.port}/download/${token}`
	request(durl)
		.on('response', function (response) {
			if (!silent) console.log(response.statusCode)
		})
		.on('error', function (err) {
			if (!silent) console.log(err)
		})
		.pipe(filestream)
}

gettoken = () => {
	const turl = `${program.host}:${program.port}/token`
	request.get(turl, (err, res, body) => {
		if (body) {
			const resp = JSON.parse(body)
			console.log(resp.token)
		}
	})
}

var program = require('commander')
program
	.version(package.version)
	.option('-h, --host <host>', 'target hostname', 'http://localhost')
	.option('-p, --port <port>', 'port number', 4200)

program
	.command('put <path> <token>')
	.description('upload file to server')
	.option("-s, --silent", "silent mode", false)
	.action((fpath, token, options) => {
		fs.access(fpath, fs.R_OK, (err) => {
			if (err) return console.log("can't acces to file", fpath)
			console.log(`upload file ${fpath} to ${program.host}:${program.port} at ${token}`);
			const fstream = fs.createReadStream(fpath)
			upload(fstream, token)
		});
	})

program
	.command('get <token> <path>')
	.description('download file from server')
	.option("-s, --silent", "silent mode", false)
	.action((token, fpath, options) => {
		console.log(`download file to ${fpath} from ${program.host}:${program.port} `);
		const fstream = fs.createWriteStream(fpath)
		download(fstream, token)
	})

program
	.command('token')
	.description('get new token')
	.option("-s, --silent", "silent mode", false)
	.action((token, options) => {
		console.log(`get new token} from ${program.host}:${program.port} `);
		gettoken()
	})

program.parse(process.argv)

if (program.args.Command == null) {
	if (!program.args.length) {
		gettoken()
	} else if (program.args.length == 1) {
		if (process.stdin.isTTY) {
			silent = true;
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


/** 


							const url = `${program.host}:${program.port}/download/${param}`
				
				process.stdout.resume();

				request(url)
				.on('response', function (response) {
					console.log(response.statusCode)
					console.log(response.headers) 
				})
				.pipe(process.stdout)


				process.stdin.resume();
				uplod
				process.stdin.pipe(request.post(url, option, (err, res, body) => {
					if (err) process.exit(1)
					console.log(body)
					process.exit(0)
				}))

				**/
