# AI Testcase Designer MCP

An MCP server that generates comprehensive API test plans (positive, negative, edge cases) from endpoint metadata, powered by AI/LLMs.

This is a TypeScript-based MCP server for automation and QA engineers. It demonstrates core Model Context Protocol concepts by providing:

- AI-powered tool for generating exhaustive test case plans from API endpoints and payloads
- Prompt-driven LLM integration for quality and coverage
- Extensible structure for future automation tooling

## Features

### Test Generation Tool
- `generate_tests_excel` - Generate test cases for APIs (positive, negative, and boundary)
  - Takes endpoint, HTTP method, payload, and schema as parameters
  - Outputs an Excel file with detailed test cases (Sl no, Test Name, Pre-Condition, Steps, Expected Result)

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

## Installation

To use with Claude Desktop or any MCP-compatible client, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "AI Testcase Designer MCP": {
      "command": "/path/to/AI Testcase Designer MCP/build/index.js"
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
