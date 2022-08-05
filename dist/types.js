"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
class Server {
    constructor(tag) {
        this.name = tag.name;
        this.user = tag.user;
        this.autoOff = tag.autoOff;
        this.instanceType = "";
        this.privateIP = "";
        this.publicIP = "";
        this.state = "";
        this.instanceID = "";
    }
}
exports.Server = Server;
