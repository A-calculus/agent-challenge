import { MCPServer } from "@mastra/mcp";
import { yourAgent } from "../agents/tokenomics-advisor-agent";
import { tokenomicsSimulationTool } from "../tools/tokenomics-simulation-tool";
import { coinEducationalAnalysisTool } from "../tools/coin-educational-analysis-tool";
import { marketChartAnalysisTool } from "../tools/market-chart-analysis-tool";
import { tokenMetadataAnalysisTool } from "../tools/token-metadata-analysis-tool";
import { weatherTool } from "../tools/weather-tool";

async function startServer() {
  try {
    console.log("🚀 Initializing Tokenomics Advisor MCP Server...");
    
    // Check if agent is properly initialized
    console.log("📊 Agent name:", yourAgent.name);
    console.log("📋 Agent description:", yourAgent.getDescription());
    console.log("🛠️ Agent tools:", Object.keys(yourAgent.tools || {}));
    
    const server = new MCPServer({
      name: "tokenomics-advisor-mcp-server",
      version: "1.0.0",
      description: "Tokenomics Advisor MCP Server providing comprehensive cryptocurrency analysis tools and expert agent",
      tools: {
        tokenomicsSimulationTool,
        coinEducationalAnalysisTool,
        marketChartAnalysisTool,
        tokenMetadataAnalysisTool,
        weatherTool,
      },
      agents: {
        tokenomicsAdvisor: yourAgent
      }
    });

    console.log("🎯 Starting MCP server on stdio...");
    console.log("✅ MCP server ready!");

    
    await server.startStdio();
    
  } catch (error) {
    console.error("❌ Error starting MCP server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\n🛑 Shutting down MCP server...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("\n🛑 Shutting down MCP server...");
  process.exit(0);
});

startServer().catch((error) => {
  console.error("💥 Failed to start server:", error);
  process.exit(1);
}); 