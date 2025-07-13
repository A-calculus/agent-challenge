# Unified Mastra + MCP Setup

This project provides a unified setup that runs both the Mastra API (playground) and MCP server together, allowing external agents to connect to your tokenomics advisor tools and agent.

## 🚀 Quick Start

### Development Mode
```bash
pnpm run dev
```
This will start both:
- **Mastra playground** at `http://localhost:4111` (for interactive agent testing)
- **MCP server** on stdio (for external agent connections)

### Production Mode
```bash
pnpm run build
```
This will:
- Build the Mastra project
- Start both the Mastra API and MCP server in production mode

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start both Mastra playground and MCP server for development |
| `pnpm run build` | Build and start both services for production |
| `pnpm run start` | Start only the Mastra API |
| `pnpm run mcp:server` | Start only the MCP server |
| `pnpm run mcp:client` | Test the MCP client connection |
| `pnpm run mcp:external` | Test external MCP client connection |
| `pnpm run test:mcp` | Run comprehensive MCP tests |

## 🔧 External Agent Configuration

External agents can connect to your MCP server using this configuration:

```json
{
  "command": "npx",
  "args": ["-y", "tsx", "src/mastra/mcp/mcp-server.ts"]
}
```

### Example for @mastra/mcp-docs-server pattern:
```json
{
  "command": "npx",
  "args": ["-y", "tsx", "src/mastra/mcp/mcp-server.ts"]
}
```

## 🛠️ Available Tools and Agent

When external agents connect, they get access to:

### Tools
- **tokenomicsSimulationTool** - Run Monte Carlo simulations for token economics
- **coinEducationalAnalysisTool** - Analyze cryptocurrency projects
- **marketChartAnalysisTool** - Analyze market trends and price movements
- **tokenMetadataAnalysisTool** - Examine token unlock schedules and distribution
- **weatherTool** - Get weather information (example tool)

### Agent
- **ask_tokenomicsAdvisor** - Professional tokenomics advisor agent with memory

## 🧪 Testing the Setup

### 1. Test Local MCP Client
```bash
pnpm run mcp:client
```

### 2. Test External MCP Connection
```bash
pnpm run mcp:external
```

### 3. Test with External Agent
Start the development server:
```bash
pnpm run dev
```

Then configure your external agent with:
```json
{
  "command": "npx",
  "args": ["-y", "tsx", "src/mastra/mcp/mcp-server.ts"]
}
```

### 4. Test in Mastra Playground
1. Run `pnpm run dev`
2. Open `http://localhost:4111` in your browser
3. Select "yourAgent" (Tokenomics Advisor Agent)
4. Start chatting with the agent

## 📊 Project Structure

```
src/
├── mastra/
│   ├── agents/
│   │   └── tokenomics-advisor-agent.ts    # Main agent
│   ├── tools/                             # Individual tools
│   ├── mcp/
│   │   ├── mcp-server.ts                  # MCP server
│   │   └── mcp-client.ts                  # MCP client
│   ├── memory/                            # Agent memory configuration
│   └── index.ts                           # Main Mastra configuration

```

## 🔄 How It Works

1. **Development Mode (`pnpm run dev`):**
   - Starts Mastra dev server (playground) on port 4111
   - Starts MCP server on stdio for external connections
   - Both run concurrently

2. **Production Mode (`pnpm run build`):**
   - Builds the Mastra project
   - Starts Mastra API server
   - Starts MCP server for external connections

3. **External Agent Connection:**
   - External agents spawn the MCP server using the command configuration
   - They get access to all tools and the tokenomics advisor agent
   - Communication happens via stdio protocol

## 🔍 Troubleshooting

### MCP Server Won't Start
- Ensure all dependencies are installed: `pnpm install`
- Check that the agent has a proper description (required for MCP)
- Verify all tools are properly imported

### External Agent Can't Connect
- Make sure the MCP server is running (`pnpm run mcp:server`)
- Verify the command configuration matches exactly
- Check that tsx is available globally or use full path

### Memory Issues
- The agent uses persistent memory, check database connection
- Memory requires `resourceId` and `threadId` for proper context

## 🎯 Usage Examples

### Ask the Agent
```typescript
const response = await tools["ask_tokenomicsAdvisor"].execute({
  context: {
    message: "What are the key factors for DeFi tokenomics?"
  }
});
```

### Run a Simulation
```typescript
const simulation = await tools["tokenomicsSimulationTool"].execute({
  context: {
    // Simulation parameters
  }
});
```

## 📝 Notes

- The setup uses `concurrently` to run multiple processes
- Both development and production modes include the MCP server
- External agents connect via stdio protocol
- The agent includes memory for persistent conversations
- All tools are exposed to external agents automatically

## 🆘 Support

If you encounter issues:
1. Check the console output for error messages
2. Test individual components with separate scripts
3. Verify all environment variables are set
4. Ensure dependencies are properly installed 