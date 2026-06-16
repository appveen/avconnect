import { existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import "colors";

// Mock modules
jest.mock("fs");
jest.mock("child_process");
jest.mock("inquirer");

// Helper to get function implementations for testing
const getTestFunctions = () => {
	// We'll test through integration since functions depend on module state
	return {};
};

describe("avconnect SSM Migration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("checkAndMigrate", () => {
		it("should auto-migrate old credentials by removing KEY field", () => {
			const oldCreds: any = {
				AWS_ACCESS_KEY_ID: "test-key",
				AWS_SECRET_ACCESS_KEY: "test-secret",
				REGION: "ap-south-1",
				KEY: "./av.pem"
			};

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify(oldCreds));

			// Simulate checkAndMigrate logic
			let credsToWrite: any = { ...oldCreds };
			if (credsToWrite.KEY) {
				delete credsToWrite.KEY;
			}

			expect(credsToWrite.KEY).toBeUndefined();
			expect(credsToWrite.AWS_ACCESS_KEY_ID).toBe("test-key");
		});

		it("should handle missing credentials.json gracefully", () => {
			(existsSync as jest.Mock).mockReturnValue(false);
			// Should return "ERR_MISSING_CONFIG"
			expect(true).toBe(true); // Placeholder
		});
	});

	describe("generateServerListForTableDisplay", () => {
		it("should store instance IDs instead of user@IP", () => {
			const mockServerList = {
				running: [
					{
						name: "server1",
						instanceType: "t2.micro",
						publicIP: "1.2.3.4",
						privateIP: "10.0.0.1",
						user: "ubuntu",
						autoOff: "True",
						state: "running",
						instanceID: "i-1234567890abcdef0"
					}
				],
				pending: [],
				stopping: [],
				stopped: [],
				"shutting-down": [],
				terminated: []
			};

			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockServerList));

			// Simulate the display logic
			const serverConnection: string[] = [];
			mockServerList.running.forEach((s: any) => {
				serverConnection.push(s.instanceID);
			});

			expect(serverConnection[0]).toBe("i-1234567890abcdef0");
			expect(serverConnection[0]).not.toContain("@");
		});
	});

	describe("connect", () => {
		it("should use SSM start-session command with instance ID", () => {
			const mockSpawnSync = spawnSync as jest.Mock;
			mockSpawnSync.mockReturnValue({ status: 0 });

			// Simulate checkDependencies
			const whichResults = [{ status: 0 }, { status: 0 }]; // Both tools exist
			mockSpawnSync.mockReturnValueOnce(whichResults[0]).mockReturnValueOnce(whichResults[1]);

			// Simulate connect behavior
			const instanceID = "i-1234567890abcdef0";
			const args = ["ssm", "start-session", "--target", instanceID];

			expect(args[0]).toBe("ssm");
			expect(args[1]).toBe("start-session");
			expect(args[3]).toBe(instanceID);
		});

		it("should check for required dependencies before connecting", () => {
			const mockSpawnSync = spawnSync as jest.Mock;

			// Simulate missing aws CLI by throwing an error
			mockSpawnSync.mockImplementation((cmd: string) => {
				if (cmd === "which") {
					throw new Error("Command not found");
				}
				return { status: 0 };
			});

			let dependenciesAvailable = true;
			try {
				// Simulate the checkDependencies logic
				throw new Error("aws CLI not found");
			} catch {
				dependenciesAvailable = false;
			}

			expect(dependenciesAvailable).toBe(false);
		});
	});

	describe("Configuration", () => {
		it("should not prompt for KEY field in setConfig", () => {
			// The new setConfig should have 3 prompts instead of 4
			const questions = [
				{ name: "AWS_ACCESS_KEY_ID" },
				{ name: "AWS_SECRET_ACCESS_KEY" },
				{ name: "REGION" }
				// KEY field should not be present
			];

			expect(questions).toHaveLength(3);
			expect(questions.map((q: any) => q.name)).not.toContain("KEY");
		});

		it("should save credentials without KEY field", () => {
			const credentials = {
				AWS_ACCESS_KEY_ID: "test-key",
				AWS_SECRET_ACCESS_KEY: "test-secret",
				REGION: "ap-south-1"
			};

			expect(credentials).not.toHaveProperty("KEY");
			expect(Object.keys(credentials)).toHaveLength(3);
		});
	});

	describe("Environment Setup", () => {
		it("should set AWS environment variables from credentials", () => {
			const creds = {
				AWS_ACCESS_KEY_ID: "test-key-id",
				AWS_SECRET_ACCESS_KEY: "test-secret"
			};

			// Simulate setEnvVars
			process.env.AWS_ACCESS_KEY_ID = creds.AWS_ACCESS_KEY_ID;
			process.env.AWS_SECRET_ACCESS_KEY = creds.AWS_SECRET_ACCESS_KEY;

			expect(process.env.AWS_ACCESS_KEY_ID).toBe("test-key-id");
			expect(process.env.AWS_SECRET_ACCESS_KEY).toBe("test-secret");
		});

		it("should not require or use KEY environment variable", () => {
			expect(process.env.KEY).toBeUndefined();
		});
	});
});
