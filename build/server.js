"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const fs_1 = require("fs");
const zod_1 = __importDefault(require("zod"));
const server = new mcp_js_1.McpServer({
    name: "MCP Server Learning Example",
    version: "1.0.0",
    title: "MCP Server Example",
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});
server.resource("users", "users://all", {
    description: "Get all users data from the database",
    title: "Users",
    mimeType: "application/json",
}, async (uri) => {
    const users = await import("./data/users.json", {
        with: { type: "json" },
    }).then(m => m.default);
    return {
        contents: [
            {
                uri: uri.href,
                text: JSON.stringify(users),
                mimeType: "application/json",
            },
        ],
    };
});
server.resource("user-details", new mcp_js_1.ResourceTemplate("users://{userId}/profile", { list: undefined }), {
    description: "Get a user's details from teh database",
    title: "User Details",
    mimeType: "application/json",
}, async (uri, { userId }) => {
    const users = await import("./data/users.json", {
        with: { type: "json" },
    }).then(m => m.default);
    const user = users.find(u => u.id === parseInt(userId));
    if (user == null) {
        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify({ error: "User not found" }),
                    mimeType: "application/json",
                },
            ],
        };
    }
    return {
        contents: [
            {
                uri: uri.href,
                text: JSON.stringify(user),
                mimeType: "application/json",
            },
        ],
    };
});
server.tool("create-user", "Create a new user in the system", {
    name: zod_1.default.string(),
    email: zod_1.default.string().email(),
    address: zod_1.default.string(),
    age: zod_1.default.number().int().min(0),
    phone: zod_1.default.string(),
}, {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
}, async (params) => {
    try {
        const userId = await createUser(params);
        return {
            content: [
                {
                    type: "text",
                    text: `User created successfully with ID: ${userId}`,
                },
            ],
        };
    }
    catch (error) {
        console.error("Error creating user:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to create user`,
                },
            ],
        };
    }
});
server.tool("create-random-user", "Create a random user with fake data", {
    title: "Create Random User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
}, async () => {
    const res = await server.server.request({
        method: "sampling/createMessage",
        params: {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Generate fake user data. The user should have a realistic name, email, address, and phone number. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse.",
                    },
                },
            ],
            maxTokens: 1024,
        },
    }, types_js_1.CreateMessageResultSchema);
    if (res.content.type !== "text") {
        return {
            content: [{ type: "text", text: "Failed to generate user data" }],
        };
    }
    try {
        const fakeUser = JSON.parse(res.content.text
            .trim()
            .replace(/^```json/, "")
            .replace(/```$/, "")
            .trim());
        const id = await createUser(fakeUser);
        return {
            content: [{ type: "text", text: `User ${id} created successfully` }],
        };
    }
    catch {
        return {
            content: [{ type: "text", text: "Failed to generate user data" }],
        };
    }
});
server.prompt("generate-fake-user", "Generate a fake user based on a given name", {
    name: zod_1.default.string(),
}, ({ name }) => {
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Generate a fake user with the name ${name}. The user should have a realistic email, address, and phone number.`,
                },
            },
        ],
    };
});
async function createUser(params) {
    const users = await import("./data/users.json", { with: { type: "json" } }).then((m) => m.default);
    const newId = users.length + 1;
    const newUsers = [...users, { id: newId, ...params }];
    (0, fs_1.writeFileSync)("./src/data/users.json", JSON.stringify(newUsers, null, 2));
    return newId;
}
async function main() {
    const trasport = new stdio_js_1.StdioServerTransport();
    await server.connect(trasport);
}
main();
