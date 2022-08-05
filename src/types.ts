
export class Server {
	name: string;
	user: string;
	autoOff: string;
	instanceType: string;
	privateIP: string;
	publicIP: string;
	state: string;
	instanceID: string;

	constructor(tag: any) {
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

export interface ServerList {
	"pending": Server[];
	"running": Server[];
	"stopped": Server[];
	"stopping": Server[];
	"shutting-down": Server[];
	"terminated": Server[];
	[key: string]: any
}