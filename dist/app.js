"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const commander_1 = require("commander");
const aws_sdk_1 = require("aws-sdk");
const cli_table3_1 = __importDefault(require("cli-table3"));
require("colors");
const inquirer_1 = require("inquirer");
const types_1 = require("./types");
const version = "2.0.0";
let REGIONS = ["ap-south-1", "ap-south-2"];
let KEY = "./av.pem";
const servers = [];
const serverNames = [];
const serverConnection = [];
const headers = ["#", "Name", "Type", "PublicIP", "PrivateIP", "User", "AutoOff"].map(h => h.yellow);
function stringComparison(a, b) {
    const nameA = a.name.toUpperCase();
    const nameB = b.name.toUpperCase();
    if (nameA < nameB)
        return -1;
    if (nameA > nameB)
        return 1;
    return 0;
}
function checkAndMigrate() {
    if ((0, fs_1.existsSync)("credentials.json"))
        return;
    if (!(0, fs_1.existsSync)("credentials") || !(0, fs_1.existsSync)("config"))
        return "ERR_MISSING_CONFIG";
    const configData = (0, fs_1.readFileSync)("config").toString();
    const credentialData = (0, fs_1.readFileSync)("credentials").toString();
    const creds = credentialData.split("\n");
    const credentials = {
        "REGION": configData,
        "AWS_ACCESS_KEY_ID": creds[1].split(" = ")[1],
        "AWS_SECRET_ACCESS_KEY": creds[2].split(" = ")[1],
        "KEY": "./av.pem"
    };
    (0, fs_1.writeFileSync)("credentials.json", JSON.stringify(credentials));
    (0, fs_1.rmSync)("credentials");
    (0, fs_1.rmSync)("config");
    console.log("Migration successful");
}
function configureRegions() {
    if ((0, fs_1.existsSync)("region.json"))
        return;
    (0, fs_1.writeFileSync)("region.json", JSON.stringify(REGIONS));
    console.log("Region Configured");
}
function setConfig() {
    return __awaiter(this, void 0, void 0, function* () {
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
        const credentials = yield (0, inquirer_1.prompt)(questions);
        (0, fs_1.writeFileSync)("credentials.json", JSON.stringify(credentials));
    });
}
function setEnvVars() {
    const creds = JSON.parse((0, fs_1.readFileSync)("credentials.json").toString());
    const regions = JSON.parse((0, fs_1.readFileSync)("region.json").toString());
    process.env.AWS_ACCESS_KEY_ID = creds.AWS_ACCESS_KEY_ID;
    process.env.AWS_SECRET_ACCESS_KEY = creds.AWS_SECRET_ACCESS_KEY;
    KEY = creds.KEY;
    REGIONS = regions;
}
function parseTags(tags) {
    const tagData = {
        name: null,
        user: "ubuntu",
        autoOff: "True"
    };
    tags.forEach((tag) => {
        if (tag.Key == "Name")
            tagData["name"] = tag.Value;
        if (tag.Key == "User")
            tagData["user"] = tag.Value;
        if (tag.Key == "AutoOff")
            tagData["autoOff"] = tag.Value;
    });
    return tagData;
}
function getEC2Instances() {
    return __awaiter(this, void 0, void 0, function* () {
        const serverList = {
            pending: [],
            running: [],
            stopped: [],
            stopping: [],
            terminated: [],
            "shutting-down": []
        };
        yield REGIONS.reduce((prev, region) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield prev;
            const ec2Client = new aws_sdk_1.EC2({ region: region });
            const listOfInstances = yield ec2Client.describeInstances().promise();
            (_a = listOfInstances.Reservations) === null || _a === void 0 ? void 0 : _a.forEach((reservations) => {
                const instance = reservations.Instances[0];
                const tags = parseTags(instance.Tags);
                const server = new types_1.Server(tags);
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
        }), Promise.resolve());
        (0, fs_1.writeFileSync)("servers.json", JSON.stringify(serverList));
    });
}
function generateServerListForTableDisplay() {
    const serverList = JSON.parse((0, fs_1.readFileSync)("servers.json").toString());
    serverList.running.forEach((s) => {
        servers.push([s.name, s.instanceType, s.publicIP, s.privateIP, s.user, s.autoOff]);
        serverNames.push(s.name);
        serverConnection.push([s.user, s.publicIP]);
    });
    serverList.pending.forEach((s) => {
        servers.push([s.name.yellow, s.instanceType, s.publicIP, s.privateIP, s.user, s.autoOff]);
        serverNames.push(s.name);
        serverConnection.push([s.user, s.publicIP]);
    });
    serverList.stopping.forEach((s) => {
        servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
        serverNames.push(s.name);
        serverConnection.push([s.user, s.publicIP]);
    });
    serverList.stopped.forEach((s) => {
        servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
        serverNames.push(s.name);
        serverConnection.push([s.user, s.publicIP]);
    });
    serverList["shutting-down"].forEach((s) => {
        servers.push([s.name.gray, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
        serverNames.push(s.name);
        serverConnection.push([s.user, s.publicIP]);
    });
    serverList.terminated.forEach((s) => {
        servers.push([`💀 ${s.name.grey}`, s.instanceType.gray, s.publicIP.gray, s.privateIP.gray, s.user.gray, s.autoOff]);
        serverNames.push(s.name);
        serverConnection.push([s.user, s.publicIP]);
    });
}
function displayTable() {
    const table = new cli_table3_1.default({
        head: headers
    });
    servers.forEach((s, index) => table.push([(index + 1).toString()].concat(s)));
    console.log(table.toString());
}
function init(refreshList, display) {
    return __awaiter(this, void 0, void 0, function* () {
        const migrationRetrunCode = checkAndMigrate();
        if (migrationRetrunCode == "ERR_MISSING_CONFIG")
            yield setConfig();
        configureRegions();
        setEnvVars();
        if (!(0, fs_1.existsSync)("servers.json") || refreshList)
            yield getEC2Instances();
        generateServerListForTableDisplay();
        if (display)
            displayTable();
    });
}
function makeSelection() {
    return __awaiter(this, void 0, void 0, function* () {
        const serverCount = serverNames.length;
        return yield (0, inquirer_1.prompt)([{
                type: "input",
                name: "selection",
                message: "Select server",
                validate: (input) => {
                    if (input < 1)
                        return false;
                    if (input > serverCount)
                        return false;
                    return true;
                }
            }]).then(_d => _d.selection - 1);
    });
}
function connect(selection) {
    return __awaiter(this, void 0, void 0, function* () {
        const table = new cli_table3_1.default();
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
        (0, child_process_1.spawnSync)("ssh", connectionArgs, { stdio: [0, 1, 2] });
    });
}
const program = new commander_1.Command();
program.name("AV Connect")
    .description("CLI utility to connect to appveen's servers")
    .version(version)
    .option("-c, --connect <selection>", "Quick connect to server", parseInt)
    .option("-r, --reload", "Reload configuration")
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    const reloadFlag = program.opts().reload;
    let selection = program.opts().connect;
    if (selection) {
        selection = selection - 1;
        yield init(reloadFlag, false);
        if (selection >= serverNames.length || selection < 0) {
            console.log("Invalid server".red);
            process.exit();
        }
        return yield connect(selection);
    }
    yield init(reloadFlag, true);
    selection = yield makeSelection();
    yield connect(selection);
}));
program.parse();
