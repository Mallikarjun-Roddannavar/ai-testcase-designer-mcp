#!/usr/bin/env node
import winston from "winston";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as XLSX from "xlsx";
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

// Winston logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `${info.timestamp} [${info.level}]: ${String(info.message)}`
    )
  ),
  transports: [
    new winston.transports.File({
      filename: serverLogPath,
      level: "info",
    }),
  ],
});
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
      logger.info(`[Step4] Calling LLM API at ${MODEL_API_URL}`);
      const response = await fetch(MODEL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MODEL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that generates software test cases.",
            },
            { role: "user", content: prompt },
          ],
          temperature: MODEL_TEMPERATURE,
          max_tokens: MODEL_MAX_TOKENS,
        }),
      });

      const data = await response.json();
      logger.info(`[Step4] LLM raw response: ${JSON.stringify(data)}`);
      if (
        !data.choices ||
        !data.choices[0] ||
        !data.choices[0].message ||
        !data.choices[0].message.content
      ) {
        logger.error(`[Step4] Bad response from LLM: ${JSON.stringify(data)}`);
        throw new Error("Bad response from LLM: " + JSON.stringify(data));
      }

      const content = data.choices[0].message.content.trim();
      // Use a multiline-safe regex to extract the full array
      let match = content.match(/\[[\s\S]*\]/);
      if (!match) {
        logger.error(
          `[Step4] No JSON array found in LLM response. Raw content below:\n-----BEGIN LLM CONTENT-----\n${content}\n-----END LLM CONTENT-----`
        );
        logger.error(
          `[Step4] Full LLM raw API response object:\n${JSON.stringify(
            data,
            null,
            2
          )}`
        );
        throw new Error("No JSON array found in LLM response.");
      }
      try {
        llmJSON = JSON.parse(match[0]);
      } catch (parseErr: any) {
        logger.error(
          `[Step4] Failed to parse JSON from LLM response. Raw output: ${content}\n[Step4][DEBUG] match[0]:\n${
            match[0]
          }\n[Step4][DEBUG] Parse error:\n${
            parseErr && parseErr.message ? parseErr.message : String(parseErr)
          }`
        );
        throw new Error(
          "Failed to parse JSON from LLM response: " +
            (parseErr && parseErr.message ? parseErr.message : String(parseErr))
        );
      }
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

    try {
      const safeEndpoint = (endpoint as string)
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 60);
      const safeMethod = String(method).toLowerCase();
      const fname = `generated_tests_${safeMethod}_${safeEndpoint}_${Date.now()}.xlsx`;
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const xlsxPath = path.join(outDir, fname);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TestCases");
      XLSX.writeFile(wb, xlsxPath);

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
