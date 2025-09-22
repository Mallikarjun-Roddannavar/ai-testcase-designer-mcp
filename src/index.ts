#!/usr/bin/env node
import logger from "./logger.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { generateTestPlanExcel } from "./excel.js";
import { fetchTestCasesFromLLM } from "./llm.js";
import * as fs from "fs";
import * as path from "path";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import config from './../configs/config.json' with { type: "json" };
const WORK_DIR = config.WORK_DIR;
const outDir = path.resolve(WORK_DIR, "generated");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const serverLogPath = path.join(outDir, "server.log");

logger.info("---------------- Starting Server ----------------");
const MODEL_API_URL =
  process.env.MODEL_API_URL ||
  "https://api.groq.com/openai/v1/chat/completions";
const MODEL_API_KEY = config.MODEL_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME || "llama-3.3-70b-versatile";
const MODEL_TEMPERATURE = Number(process.env.MODEL_TEMPERATURE ?? 0.1);
const MODEL_MAX_TOKENS = Number(process.env.MODEL_MAX_TOKENS ?? 2000);

const ALLOW_DYNAMIC_SCHEMA = process.env.ALLOW_DYNAMIC_SCHEMA === "true";

if (!MODEL_API_KEY) {
  logger.error(
    "Missing MODEL_API_KEY environment variable. Set MODEL_API_KEY to your model service API key."
  );
  process.exit(1);
}
// -----------------------------
// MCP Server Initialization
// -----------------------------
const server = new Server(
  {
    name: "AI Testcase Designer MCP",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Only provide the "generate_tests_excel" tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_tests_excel",
        description:
          "Generate a comprehensive API test plan with positive, negative, and boundary value analysis test cases. Output is Excel with columns: Sl no, Test Name, Pre-Condition, Steps, Expected Result",
        inputSchema: {
          type: "object",
          properties: {
            endpoint: {
              type: "string",
              description:
                "API endpoint to test (e.g., https://api.example.com/v1/users)",
            },
            method: {
              type: "string",
              description: "HTTP method (GET, POST, etc.)",
            },
            payload: {
              type: "object",
              description: "Sample payload for the request (if applicable)",
              nullable: true,
            },
            extraContext: {
              type: "string",
              description:
                "Any additional instructions/context for the test plan",
              nullable: true,
            },
            payloadSchema: {
              type: "string",
              description:
                "Optional stringified zod schema definition for validating the payload dynamically",
              nullable: true,
            },
          },
          required: ["endpoint", "method"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  try {
    if (request.params.name !== "generate_tests_excel") {
      return {
        content: [
          {
            type: "text",
            text: "Unknown tool",
          },
        ],
      };
    }
    const { endpoint, method, payload, extraContext } =
      request.params.arguments || {};
    logger.info(
      `[Step1] Incoming request: endpoint=${endpoint}, method=${method}, payload=${JSON.stringify(
        payload
      )}, extraContext=${extraContext}`
    );
    if (!endpoint || !method) {
      logger.error(`[Step1] endpoint and method required`);
      return {
        content: [
          {
            type: "text",
            text: "endpoint and method required",
          },
        ],
      };
    }

    // Step2: Prompt construction
    logger.info(
      `[Step2] Building LLM prompt for endpoint ${endpoint} (${method})`
    );
    let prompt = `You are a Test Engineer. Please create a comprehensive test plan for the API endpoint:\n${String(
      method
    ).toUpperCase()} ${endpoint}\n`;
    if (payload && Object.keys(payload).length > 0) {
      prompt += `\nSample Payload:\n${JSON.stringify(payload, null, 2)}\n`;
    }
    prompt += fs.readFileSync(
      path.join(WORK_DIR, "src", "prompts", "testcase_prompt.txt"),
      "utf-8"
    );
    if (extraContext) {
      prompt += `\nAdditional context: ${extraContext}\n`;
    }
    logger.info(`[Step3] Prompt constructed. Length: ${prompt.length} chars`);

    // -----------------------------
    // LLM API call
    // -----------------------------
    let llmJSON: any;
    try {
      llmJSON = await fetchTestCasesFromLLM({
        prompt,
        apiUrl: MODEL_API_URL,
        apiKey: MODEL_API_KEY,
        modelName: MODEL_NAME,
        temperature: MODEL_TEMPERATURE,
        maxTokens: MODEL_MAX_TOKENS,
        logger
      });
    } catch (error: any) {
      logger.error(
        `[Step4] Failed to generate test cases in JSON format from LLM: ${error.message}`
      );
      throw new Error(
        "Failed to generate test cases in JSON format from LLM: " +
          error.message
      );
    }

    // -----------------------------
    // Convert LLM JSON to Excel rows
    // -----------------------------
    logger.info(
      `[Step5] Converting LLM JSON to Excel rows (${llmJSON.length} test cases)`
    );
    const rows = llmJSON.map((tc: any, index: number) => {
      return [
        (index + 1).toString(),
        tc.name,
        tc.preCondition ? tc.preCondition : "",
        tc.steps.join("\n"),
        tc.expectedResults.join("\n"),
      ];
    });
    // Ensure headers are present

    try {
      // Excel file export using modular handler
      const xlsxPath = await generateTestPlanExcel(
        rows,
        outDir,
        String(endpoint),
        String(method)
      );

      logger.info(`[Step6] Test plan saved to ${xlsxPath}`);

      return {
        content: [
          {
            type: "text",
            text: `Excel file written to: ${xlsxPath}`,
          },
        ],
      };
    } catch (e: any) {
      logger.error(`[Step6] Failed to create/write Excel file: ${e.message}`);
      return {
        content: [
          {
            type: "text",
            text: "Failed to create/write Excel file: " + e.message,
          },
        ],
      };
    }
  } catch (e: any) {
    logger.error(`[server error] ${e.message}`);
    return {
      content: [
        {
          type: "text",
          text: "Server error: " + e.message,
        },
      ],
    };
  }
});

// -----------------------------
// Start the MCP server (stdio transport)
// -----------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Server error: " + error);
  process.exit(1);
});
