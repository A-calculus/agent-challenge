import { MCPClient } from "@mastra/mcp";

async function main() {
  console.log("🔗 Testing Tokenomics Advisor MCP Client Connection\n");
  
  // Create MCP client that connects to the tokenomics advisor server
  const mcp = new MCPClient({
    servers: {
      tokenomicsAdvisor: {
        command: "npx",
        args: ["tsx", "src/mastra/mcp/mcp-server.ts"]
      }
    }
  });

  try {
    console.log("📡 Connecting to Tokenomics Advisor MCP Server...");
    
    // Get available tools from the server
    const tools = await mcp.getTools();
    console.log("✅ Available tools:", Object.keys(tools));
    
    // Display each tool with its description
    console.log("\n📋 Tool Details:");
    Object.entries(tools).forEach(([name, tool]) => {
      console.log(`  🛠️ ${name}: ${tool.description}`);
    });
    
    // Test the tokenomics advisor agent
    const agentToolName = "ask_tokenomicsAdvisor";
    if (tools[agentToolName]) {
      console.log(`\n🎯 Testing ${agentToolName}...`);
      
      try {
        const response = await tools[agentToolName].execute({
          context: {
            message: "Hello! What are the key factors to consider when designing tokenomics for a DeFi protocol?"
          }
        });
        
        console.log("💡 Tokenomics Advisor Response:");
        console.log(response);
      } catch (error) {
        console.error("❌ Error testing agent:", error);
      }
    }
    
    // Test a direct tool
    const simulationToolName = "tokenomicsSimulationTool";
    if (tools[simulationToolName]) {
      console.log(`\n🧪 Testing ${simulationToolName}...`);
      console.log("ℹ️ This tool requires specific parameters, skipping execution test");
    }
    
    console.log("\n✅ MCP Client test completed successfully!");
    
  } catch (error) {
    console.error("❌ Error connecting to MCP server:", error);
  } finally {
    // Clean up the connection
    console.log("\n🔌 Disconnecting from MCP server...");
    await mcp.disconnect();
    console.log("✅ Disconnected successfully");
  }
}

// Run the client
main().catch(console.error); 