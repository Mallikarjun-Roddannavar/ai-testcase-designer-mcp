# 🤖 AI Testcase Designer MCP

An **MCP server** that generates comprehensive **API test plans** (positive, negative, and boundary/edge cases) directly from endpoint metadata—powered by **LLMs**.

This is a TypeScript-based MCP server for QA engineers. It demonstrates core Model Context Protocol concepts by providing:

- AI-powered tool for generating exhaustive test case plans from API endpoints and payloads
- Prompt-driven LLM integration for quality and coverage
- Extensible structure for future automation tooling

## ✨ Features

- 🔌 **MCP-compliant server** (`stdio` transport).  
- 📝 Tool: `generate_tests_excel`  
  - Input: endpoint, HTTP method, payload, schema, extra context.  
  - Output: Styled 📊 **Excel test plan** with columns:  
    *Sl no, Test Name, Pre-Condition, Steps, Expected Result*.  
- 🧠 **Prompt-driven test generation** with configurable LLM (Groq, OpenAI, Anthropic).  
- 📜 Detailed logging with **Winston**. 

## 📂 Project Structure


```plaintext
ai-testcase-designer-mcp/
├── build/                       # Compiled JS output
├── configs/
│    └── config.json             # Server/tool config
├── src/
│    ├── index.ts                # Main server entrypoint
│    └── prompts/
│         └── testcase_prompt.txt# Prompt template for LLM generation
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```
---

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## ⚙️ Installation (Claude Desktop / MCP Client)

To use with Claude Desktop or any MCP-compatible client, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "AI Testcase Designer MCP": {
      "command": "C:/path/to/ai-testcase-designer-mcp/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## ▶️ Example Request

```json
{
  "name": "generate_tests_excel",
  "arguments": {
    "endpoint": "https://api.example.com/v1/users",
    "method": "POST",
    "payload": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "extraContext": "Focus on invalid email and empty payload scenarios."
  }
}
```

## 📊 Example Excel Output

| Sl no | Test Name         | Pre-Condition | Steps                               | Expected Result           |
|-------|-------------------|---------------|-------------------------------------|---------------------------|
| 1     | Valid User Create | DB is empty   | Send POST with valid payload        | User created successfully |
| 2     | Missing Email     | DB is empty   | Send POST with name only            | 400 validation error      |
| 3     | Invalid Email     | DB is empty   | Send POST with invalid email format | 422 error message         |

## 📂 Files Output

Files are written to: ./workdir/generated/

---

## 🏗️ Architecture

```mermaid
flowchart TD
    A[Claude / MCP Client] -->|Run Tool| B[MCP Server]
    B -->|Prompt| C[LLM API]
    C -->|Test Cases JSON| B
    B -->|Excel Export| D[(Test Plan .xlsx)]
    B -->|Logs| E[Server Log File]
```

### Sample Log Output

```log
2025-09-13T10:22:11 [info]: [Step1] Incoming request: endpoint=/v1/users, method=POST
2025-09-13T10:22:11 [info]: [Step2] Building LLM prompt...
2025-09-13T10:22:13 [info]: [Step5] Converting LLM JSON to Excel rows (15 test cases)
