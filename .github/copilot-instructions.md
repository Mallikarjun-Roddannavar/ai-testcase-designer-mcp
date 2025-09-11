# Copilot Instructions for Comprehensive TestCase MCP

## Project Overview

This codebase implements a Model Context Protocol (MCP) server for generating comprehensive API test plans (positive, negative, and edge cases) from endpoint metadata. The server is written in TypeScript and exposes a single tool: `generate_tests_excel`.

## Architecture & Key Components

- **src/index.ts**: Main MCP server entry point. Handles tool registration, LLM prompt construction, and Excel file generation.
generation and Excel export.
- **build/**: Compiled JavaScript output. Do not edit directly.

## Developer Workflows

- **Install dependencies:**
  ```bash
  npm install
  ```
- **Build the server:**
  ```bash
  npm run build
  ```
- **Run the MCP server:**
  ```bash
  node build/index.js
  ```
- **Development with auto-rebuild:**
  ```bash
  npm run watch
  ```
- **Debugging:**
  Use `npm run inspector` to launch the MCP Inspector for stdio debugging.

## Tooling & Usage

- The only exposed tool is `generate_tests_excel` (see `src/index.ts`).
  - Required params: `endpoint` (string), `method` (string)
  - Optional: `payload` (object), `extraContext` (string), `payloadSchema` (stringified zod schema)
- Tool output is an Excel file in `/generated`.
- The LLM prompt is carefully engineered for test case structure and boundary coverage (see `src/index.ts` and `src/generate_tests/generateTest_llm.ts`).

## Project Conventions & Patterns

- **Environment variables** (see `.env`):
  - `MODEL_API_KEY` (required)
  - `MODEL_API_URL`, `MODEL_NAME`, `MODEL_TEMPERATURE`, `MODEL_MAX_TOKENS`, `OUTPUT_DIR`, `ALLOW_DYNAMIC_SCHEMA` (optional)
- **TypeScript strict mode** is enforced (see `tsconfig.json`).
- **No direct editing of build/**: Always edit TypeScript sources in `src/`.
- **Excel output**: All test plans are written as `.xlsx` files using the `xlsx` library.
- **MCP config**: For Claude Desktop or other clients, see `cline_mcp_settings.json` for server registration.

## Integration Points

- **LLM API**: Uses Groq's OpenAI-compatible API (see `MODEL_API_URL`).
- **MCP protocol**: Communicates over stdio (see `src/index.ts`).
- **Inspector**: For debugging MCP protocol, use the Inspector script.

## Examples

- To generate a test plan for a PATCH endpoint:
  - Call `generate_tests_excel` with `{ endpoint: "https://api.example.com/v1/users/{userId}", method: "PATCH" }`
- To add new tools, register them in `src/index.ts` using `server.setRequestHandler`.

---

If you update the tool schema or add new tools, document them here. For questions about conventions or unclear patterns, ask the project maintainer.
