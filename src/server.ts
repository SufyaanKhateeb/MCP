import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { writeFile, writeFileSync } from "fs";
import z from "zod";

const server = new McpServer({
    name: "MCP Server Learning Example",
    version: "1.0.0",
    title: "MCP Server Example",
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});

server.resource(
  "users",
  "users://all",
  {
    description: "Get all users data from the database",
    title: "Users",
    mimeType: "application/json",
  },
  async uri => {
    const users = await import("./data/users.json", {
      with: { type: "json" },
    }).then(m => m.default)

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(users),
          mimeType: "application/json",
        },
      ],
    }
  }
)

server.resource(
  "user-details",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  {
    description: "Get a user's details from teh database",
    title: "User Details",
    mimeType: "application/json",
  },
  async (uri, { userId }) => {
    const users = await import("./data/users.json", {
      with: { type: "json" },
    }).then(m => m.default)
    const user = users.find(u => u.id === parseInt(userId as string))

    if (user == null) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ error: "User not found" }),
            mimeType: "application/json",
          },
        ],
      }
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(user),
          mimeType: "application/json",
        },
      ],
    }
  }
)

server.tool(
    "create-user",
    "Create a new user in the system",
    {
        name: z.string(),
        email: z.string().email(),
        address: z.string(),
        age: z.number().int().min(0),
        phone: z.string(),
    },
    {
        title: "Create User",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
    },
    async (params) => {
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
        } catch (error) {
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
    }
);

server.tool(
  "create-random-user",
  "Create a random user with fake data",
  {
    title: "Create Random User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async () => {
    const res = await server.server.request(
      {
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
      },
      CreateMessageResultSchema
    )

    if (res.content.type !== "text") {
      return {
        content: [{ type: "text", text: "Failed to generate user data" }],
      }
    }

    try {
      const fakeUser = JSON.parse(
        res.content.text
          .trim()
          .replace(/^```json/, "")
          .replace(/```$/, "")
          .trim()
      )

      const id = await createUser(fakeUser)
      return {
        content: [{ type: "text", text: `User ${id} created successfully` }],
      }
    } catch {
      return {
        content: [{ type: "text", text: "Failed to generate user data" }],
      }
    }
  }
)

server.prompt(
  "generate-fake-user",
  "Generate a fake user based on a given name",
  {
    name: z.string(),
  },
  ({ name }) => {
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
    }
  }
)

async function createUser(params: { name: string; email: string; address: string; age: number; phone: string }) {
    const users = await import("./data/users.json", { with: { type: "json" } }).then((m) => m.default);
    const newId = users.length + 1;
    const newUsers = [...users, { id: newId, ...params }];
    writeFileSync("./src/data/users.json", JSON.stringify(newUsers, null, 2));
    return newId;
}

async function main() {
    const trasport = new StdioServerTransport();
    await server.connect(trasport);
}

main();
