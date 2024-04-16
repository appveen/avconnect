import { existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import { Command } from "commander";
import { EC2 } from "aws-sdk";
import CliTable3 from "cli-table3";
import "colors";
import { prompt } from "inquirer";
import { Server, ServerList } from "./types";

const version = "2.0.0";

let REGIONS = ["ap-south-1", "ap-south-2"];
let KEY = "./av.pem";
const servers: string[][] = [];
const serverNames: string[] = [];
const serverConnection: string[][] = [];


const headers = ["#", "Name", "Type", "PublicIP", "PrivateIP", "User", "AutoOff"].map(h => h.yellow);

function stringComparison(a: Server, b: Server) {
	const nameA = a.name.toUpperCase();
	const nameB = b.name.toUpperCase();
	if (nameA < nameB) return -1;
	if (nameA > nameB) return 1;
	return 0;
}

function checkAndMigrate() {
	if (existsSync("credentials.json")) return;
	if (!existsSync("credentials") || !existsSync("config")) return "ERR_MISSING_CONFIG";
	const configData = readFileSync("config").toString();
	const credentialData = readFileSync("credentials").toString();
	const creds = credentialData.split("\n");
	const credentials = {
		"REGION": configData,
		"AWS_ACCESS_KEY_ID": creds[1].split(" = ")[1],
		"AWS_SECRET_ACCESS_KEY": creds[2].split(" = ")[1],
		"KEY": "./av.pem"
	};
	writeFileSync("credentials.json", JSON.stringify(credentials));
	rmSync("credentials");
	rmSync("config");
	console.log("Migration successful");
}

function configureRegions() {
	if (existsSync("region.json")) return;
	writeFileSync("region.json", JSON.stringify(REGIONS));
	console.log("Region Configured");
}

async function setConfig() {
	const questions = [
		{
			type: "input",
			name: "AWS_ACCESS_KEY_ID",
			message: "ACCESS KEY ID: ",
		},
		{
			type: "input",
			name: "AWS_SECRET_ACCESS_KEY",
			message: "SECRET ACCESS KEY: ",
		},
		{
			type: "input",
			name: "REGION",
			message: "REGION: ",
		},
		{
			type: "input",
			name: "KEY",
			message: "Path to key file",
		},
	];
	const credentials = await prompt(questions);
	writeFileSync("credentials.json", JSON.stringify(credentials));
}

function setEnvVars() {
	const creds = JSON.parse(readFileSync("credentials.json").toString());
	const regions = JSON.parse(readFileSync("region.json").toString());
	process.env.AWS_ACCESS_KEY_ID = creds.AWS_ACCESS_KEY_ID;
	process.env.AWS_SECRET_ACCESS_KEY = creds.AWS_SECRET_ACCESS_KEY;
	KEY = creds.KEY;
	REGIONS = regions;
}

function parseTags(tags: any) {
	const tagData = {
		name: null,
		user: "ubuntu",
		autoOff: "True"
	};
	tags.forEach((tag: any) => {
		if (tag.Key == "Name") tagData["name"] = tag.Value;
		if (tag.Key == "User") tagData["user"] = tag.Value;
		if (tag.Key == "AutoOff") tagData["autoOff"] = tag.Value;
	});
	return tagData;
}

async function getEC2Instances() {
	const serverList: ServerList = {
		pending: [],
		running: [],
		stopped: [],
		stopping: [],
		terminated: [],
		"shutting-down": []
	};
	await REGIONS.reduce(async (prev, region) => {
		await prev;
		const ec2Client = new EC2({ region: region });
		const listOfInstances = await ec2Client.describeInstances().promise();
		listOfInstances.Reservations?.forEach((reservations: any) => {
			const instance = reservations.Instances[0];
			const tags = parseTags(instance.Tags);
			const server = new Server(tags);
			server.instanceType = instance.InstanceType;
			server.privateIP = instance.PrivateIpAddress;
			server.publicIP = instance.PublicIpAddress || "---";
			server.state = instance.State.Name || null;
			server.instanceID = instance.InstanceId;
			serverList[server.state].push(server);
		});

		serverList.pending = serverList.pending.sort(stringComparison);
		serverList.running = serverList.running.sort(stringComparison);
		serverList.stopped = serverList.stopped.sort(stringComparison);
		serverList.stopping = serverList.stopping.sort(stringComparison);
		serverList.terminated = serverList.terminated.sort(stringComparison);
		serverList["shutting-down"] = serverList["shutting-down"].sort(stringComparison);
	}, Promise.resolve());
	writeFileSync("servers.json", JSON.stringify(serverList));
}

function generateServerListForTableDisplay() {
	const serverList = JSON.parse(readFileSync("servers.json").toString());
	serverList.running.forEach((s: Server) => {
		servers.push([s.name, s.instanceType, s.publicIP, s.privateIP, s.user, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push([s.user, s.publicIP]);
	});
	serverList.pending.forEach((s: Server) => {
		servers.push([s.name.yellow, s.instanceType, s.publicIP, s.privateIP, s.user, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push([s.user, s.publicIP]);
	});
	serverList.stopping.forEach((s: Server) => {
		servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push([s.user, s.publicIP]);
	});
	serverList.stopped.forEach((s: Server) => {
		servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push([s.user, s.publicIP]);
	});
	serverList["shutting-down"].forEach((s: Server) => {
		servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push([s.user, s.publicIP]);
	});
	serverList.terminated.forEach((s: Server) => {
		servers.push([`💀 ${s.name.grey}`, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push([s.user, s.publicIP]);
	});
}

function displayTable() {
	const table = new CliTable3({
		head: headers
	});
	servers.forEach((s: string[], index: number) => table.push([(index + 1).toString()].concat(s)));

	console.log(table.toString());
}

async function init(refreshList: boolean, display: boolean) {
	const migrationRetrunCode = checkAndMigrate();
	if (migrationRetrunCode == "ERR_MISSING_CONFIG") await setConfig();
	configureRegions();
	setEnvVars();

	if (!existsSync("servers.json") || refreshList)
		await getEC2Instances();



	generateServerListForTableDisplay();
	if (display) displayTable();
}

async function makeSelection() {
	const serverCount = serverNames.length;
	return await prompt([{
		type: "input",
		name: "selection",
		message: "Select server",
		validate: (input) => {
			if (input < 1) return false;
			if (input > serverCount) return false;
			return true;
		}
	}]).then(_d => _d.selection - 1);
}

async function connect(selection: number) {
	const table = new CliTable3();

	if (serverConnection[selection][1] === "---") {
		table.push(["Error".red]);
		table.push([`Cannot connect to server ${serverNames[selection].red}`]);
		console.log(table.toString());
		process.exit();
	}

	const connectionArgs = ["-i", KEY, serverConnection[selection].join("@")];
	table.push([`Connection string for ${serverNames[selection].yellow}`]);
	table.push([`ssh ${connectionArgs.join(" ")}`]);
	console.log(table.toString());

	spawnSync("ssh", connectionArgs, { stdio: [0, 1, 2] });
}

const program = new Command();

program.name("AV Connect")
	.description("CLI utility to connect to appveen's servers")
	.version(version)
	.option("-c, --connect <selection>", "Quick connect to server", parseInt)
	.option("-r, --reload", "Reload configuration")
	.action(async () => {
		const reloadFlag = program.opts().reload;

		let selection = program.opts().connect;
		if (selection) {
			selection = selection - 1;
			await init(reloadFlag, false);
			if (selection >= serverNames.length || selection < 0) {
				console.log("Invalid server".red);
				process.exit();
			}
			return await connect(selection);
		}

		await init(reloadFlag, true);
		selection = await makeSelection();
		await connect(selection);
	});

program.parse();