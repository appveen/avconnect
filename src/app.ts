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
const servers: string[][] = [];
const serverNames: string[] = [];
const serverConnection: string[] = [];


const headers = ["#", "Name", "Type", "PublicIP", "PrivateIP", "User", "AutoOff"].map(h => h.yellow);

function stringComparison(a: Server, b: Server) {
	const nameA = a.name.toUpperCase();
	const nameB = b.name.toUpperCase();
	if (nameA < nameB) return -1;
	if (nameA > nameB) return 1;
	return 0;
}

function checkAndMigrate() {
	if (existsSync("credentials.json")) {
		return;
	}
	if (!existsSync("credentials") || !existsSync("config")) return "ERR_MISSING_CONFIG";
	const configData = readFileSync("config").toString();
	const credentialData = readFileSync("credentials").toString();
	const creds = credentialData.split("\n");
	const credentials = {
		"REGION": configData,
		"AWS_ACCESS_KEY_ID": creds[1].split(" = ")[1],
		"AWS_SECRET_ACCESS_KEY": creds[2].split(" = ")[1],
		"KEY": creds[3]?.split(" = ")[1] || ""
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
			message: "SSH KEY PATH (for SSH connections, can be left empty): ",
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
	process.env.AWS_REGION = creds.REGION;
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
		serverConnection.push(s.instanceID);
	});
	serverList.pending.forEach((s: Server) => {
		servers.push([s.name.yellow, s.instanceType, s.publicIP, s.privateIP, s.user, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push(s.instanceID);
	});
	serverList.stopping.forEach((s: Server) => {
		servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push(s.instanceID);
	});
	serverList.stopped.forEach((s: Server) => {
		servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push(s.instanceID);
	});
	serverList["shutting-down"].forEach((s: Server) => {
		servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push(s.instanceID);
	});
	serverList.terminated.forEach((s: Server) => {
		servers.push([`💀 ${s.name.grey}`, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
		serverNames.push(s.name);
		serverConnection.push(s.instanceID);
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

function checkDependencies(): boolean {
	try {
		spawnSync("which", ["aws"], { stdio: "pipe" });
	} catch (e) {
		console.log("Error: AWS CLI not found. Please install aws-cli.".red);
		return false;
	}

	try {
		spawnSync("which", ["session-manager-plugin"], { stdio: "pipe" });
	} catch (e) {
		console.log("Error: session-manager-plugin not found. Please install aws-sessions-manager-plugin.".red);
		return false;
	}

	return true;
}

async function connect(selection: number) {
	const table = new CliTable3();
	const creds = JSON.parse(readFileSync("credentials.json").toString());
	const serverList = JSON.parse(readFileSync("servers.json").toString());

	const connectionMethod = await prompt([{
		type: "list",
		name: "method",
		message: "Connect via:",
		choices: ["SSM", "SSH"]
	}]).then(d => d.method);

	if (connectionMethod === "SSM") {
		if (!checkDependencies()) {
			process.exit(1);
		}

		const instanceID = serverConnection[selection];
		table.push([`Connecting to ${serverNames[selection].yellow}`]);
		table.push([`aws ssm start-session --target ${instanceID}`]);
		console.log(table.toString());

		spawnSync("aws", ["ssm", "start-session", "--target", instanceID], { stdio: [0, 1, 2] });
	} else {
		if (!creds.KEY) {
			console.log("Error: SSH key path not configured. Run with --reload to set it.".red);
			process.exit(1);
		}

		const allServers = [
			...serverList.running,
			...serverList.pending,
			...serverList.stopping,
			...serverList.stopped,
			...serverList["shutting-down"],
			...serverList.terminated
		];
		const selectedServer = allServers.find((s: Server) => s.instanceID === serverConnection[selection]);
		const user = selectedServer?.user || "ubuntu";
		const publicIP = selectedServer?.publicIP;

		if (publicIP === "---") {
			console.log("Error: Selected server has no public IP. Use SSM instead.".red);
			process.exit(1);
		}

		table.push([`Connecting to ${serverNames[selection].yellow}`]);
		table.push([`ssh -i ${creds.KEY} ${user}@${publicIP}`]);
		console.log(table.toString());

		spawnSync("ssh", ["-i", creds.KEY, `${user}@${publicIP}`], { stdio: [0, 1, 2] });
	}
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