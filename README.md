# Tokenomics Advisor AI Agent 🚀

[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-acalculus/tokenomics--advisor--playground-blue)](https://hub.docker.com/r/acalculus/tokenomics-advisor-playground)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue)](https://www.typescriptlang.org/)
[![Mastra](https://img.shields.io/badge/Mastra-0.10.5+-purple)](https://mastra.ai/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-orange)](https://github.com/modelcontextprotocol/servers)

A comprehensive AI-powered tokenomics advisor that provides professional cryptocurrency analysis, market insights, and strategic guidance through multiple interfaces including a web playground, MCP (Model Context Protocol) server, and REST API.

![Tokenomics Advisor Banner](./assets/NosanaBuildersChallengeAgents.jpg)

## 🎯 Overview

The Tokenomics Advisor is a sophisticated AI agent built with [Mastra](https://mastra.ai/) that specializes in cryptocurrency tokenomics analysis. It provides comprehensive tools for:

- **Monte Carlo Tokenomics Simulations** - Advanced modeling of token economics
- **Market Analysis** - Real-time cryptocurrency market data and trends
- **Educational Analysis** - Deep dive into project fundamentals and metrics
- **Token Metadata Analysis** - Unlock schedules and distribution patterns
- **Professional Advisory** - Expert guidance with persistent memory

## 🏗️ Architecture

The project implements a unified architecture that serves multiple interfaces:

```
┌─────────────────────────────────────────────────────────────┐
│                    External Clients                         │
├─────────────────────────────────────────────────────────────┤
│  Web Playground  │  MCP Clients  │  REST API  │  Docker     │
├─────────────────────────────────────────────────────────────┤
│                    Mastra Framework                         │
├─────────────────────────────────────────────────────────────┤
│  Tokenomics Agent │  Tools Suite  │  Memory    │  Workflows  │
├─────────────────────────────────────────────────────────────┤
│          External APIs (CoinGecko, Mobula, etc.)           │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
agent-challenge/
├── src/
│   └── mastra/
│       ├── agents/
│       │   └── tokenomics-advisor-agent.ts    # Main AI agent
│       ├── tools/                             # Analysis tools
│       │   ├── tokenomics-simulation-tool.ts  # Monte Carlo simulations
│       │   ├── coin-educational-analysis-tool.ts # Project analysis
│       │   ├── market-chart-analysis-tool.ts  # Market data analysis
│       │   ├── token-metadata-analysis-tool.ts # Token metadata
│       │   └── weather-tool.ts                # Example tool
│       ├── mcp/                               # MCP server & client
│       │   ├── mcp-server.ts                  # MCP protocol server
│       │   └── mcp-client.ts                  # MCP test client
│       ├── memory/                            # Persistent memory
│       │   └── tokenomics-advisor-memory.ts   # Agent memory config
│       ├── workflows/                         # Workflow definitions
│       │   └── weather-workflow.ts            # Example workflow
│       ├── config.ts                          # Model configuration
│       └── index.ts                           # Main Mastra setup
├── nos_job_def/
│   └── nosana_mastra.json                     # Nosana deployment config
├── assets/
│   └── NosanaBuildersChallengeAgents.jpg      # Project banner
├── .mastra/                                   # Mastra build output
├── Dockerfile                                 # Container configuration
├── package.json                               # Dependencies & scripts
├── tsconfig.json                              # TypeScript configuration
├── SETUP.md                                   # Setup instructions
└── README.md                                  # This file
```

## 🛠️ Tools & Capabilities

### 1. Tokenomics Simulation Tool
**Advanced Monte Carlo modeling for token economics**

- **Purpose**: Run comprehensive simulations of token price evolution and supply dynamics
- **Features**:
  - Monte Carlo analysis with multiple iterations
  - Token distribution modeling (team, advisors, community, etc.)
  - Vesting schedule simulation
  - Market condition scenarios (bull, bear, stable, crash)
  - Liquidity and trading dynamics
  - Staking and burning mechanisms
  - Risk metrics and stress testing
- **Input Parameters**: Asset name, supply details, distribution percentages, vesting schedules, market conditions
- **Output**: Price trajectories, volatility metrics, risk analysis, strategic recommendations

### 2. Token Educational Analysis Tool
**Comprehensive cryptocurrency project evaluation**

- **Purpose**: Analyze cryptocurrency projects for educational and investment insights
- **Features**:
  - Project fundamentals assessment
  - Community engagement metrics
  - Development activity tracking
  - Market position analysis
  - Social media and communication channels
  - GitHub repository analysis
- **Data Sources**: CoinGecko API
- **Output**: Project health score, community strength, development activity, market insights

### 3. Market Chart Analysis Tool
**Real-time market data and trend analysis**

- **Purpose**: Analyze cryptocurrency price movements and trading patterns
- **Features**:
  - Historical price data analysis
  - Volume and market cap trends
  - Volatility calculations
  - Technical indicators
  - Trend direction and strength
  - Maximum drawdown analysis
- **Data Sources**: CoinGecko API
- **Output**: Price metrics, volume analysis, trend indicators, volatility measures

### 4. Token Metadata Analysis Tool
**Token unlock schedules and distribution analysis**

- **Purpose**: Examine token distribution patterns and unlock schedules
- **Features**:
  - Supply metrics calculation
  - Unlock schedule analysis
  - Distribution risk assessment
  - Market impact predictions
  - Concentration risk evaluation
- **Data Sources**: Mobula API
- **Output**: Supply analysis, unlock timeline, distribution metrics, risk assessments

### 5. Weather Tool
**Example tool for location-based weather data**

- **Purpose**: Demonstrates tool integration patterns
- **Features**: Current weather conditions for any location
- **Data Sources**: Weather API
- **Output**: Temperature, conditions, humidity, wind speed

## 🤖 Tokenomics Advisor Agent

The main AI agent combines all tools with professional expertise:

### Core Capabilities
- **Professional Analysis**: Expert-level tokenomics guidance
- **Memory Integration**: Persistent conversation context
- **Multi-tool Coordination**: Seamless tool integration
- **Educational Focus**: Clear explanations of complex concepts
- **Risk Assessment**: Balanced analysis with risk considerations

### Interaction Guidelines
- Maintains objectivity and avoids financial advice
- Provides educational value and professional insights
- Explains technical concepts in accessible terms
- Offers actionable recommendations based on analysis
- Acknowledges limitations and uncertainties

### Memory System
- **Persistent Memory**: Remembers user preferences and context
- **Thread Management**: Maintains conversation history
- **Personalization**: Adapts responses based on user interactions
- **Context Awareness**: References previous analyses and discussions

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version 20.9.0 or higher
- **pnpm**: Package manager (recommended)
- **API Keys**: Mistral and/or Gemini API keys

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd agent-challenge
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   # AI Model Configuration
   MISTRAL=your_mistral_api_key_here
   
   # Model Selection 
   MM=mistral-large-latest
   ```

4. **Start development server**
   ```bash
   pnpm run dev
   ```

This will start:
- **Mastra Playground**: http://localhost:8080 (Interactive web interface)
- **MCP Server**: Running on stdio for external agent connections

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start development mode (playground + MCP server) |
| `pnpm run build` | Build the project |
| `pnpm run start` | Start production mode (API + MCP server) |
| `pnpm run mcp:server` | Start only the MCP server |
| `pnpm run mcp:client` | Test MCP client connection |
| `pnpm run lint` | Run code linting |
| `pnpm run format` | Format code with Biome |
| `pnpm run check` | Run code quality checks |
| `pnpm run deploy:agent` | Deploy to Nosana network |

## 🔌 Usage Examples

### Web Playground
1. Start the development server: `pnpm run dev`
2. Open http://localhost:8080 in your browser
3. Select "yourAgent" (Tokenomics Advisor Agent)
4. Start chatting with the agent

### MCP Integration
External agents can connect using:
```json
{
  "command": "npx",
  "args": ["-y", "tsx", "src/mastra/mcp/mcp-server.ts"]
}
```

### API Usage
```typescript

// Example: Analyze a cryptocurrency project
const analysis = await tools["coinEducationalAnalysisTool"].execute({
  context: {
    coinId: "ethereum"
  }
});
```

## 🐳 Docker Deployment

### Quick Start with Docker
```bash
# Pull and run the pre-built image
docker run -p 8080:8080 acalculus/tokenomics-advisor-playground:latest
```

### Building from Source
```bash
# Build the Docker image
docker build -t tokenomics-advisor .

# Run the container
docker run -p 8080:8080 --env-file .env tokenomics-advisor
```

### Docker Hub
The project is available on Docker Hub:
- **Repository**: `acalculus/tokenomics-advisor-playground`
- **Tags**: `latest` (main branch)
- **Platform**: Multi-architecture support

## ☁️ Nosana Deployment

Deploy to the Nosana decentralized compute network:

```bash
# Deploy to Nosana
pnpm run deploy:agent
```

The deployment configuration is in `nos_job_def/nosana_mastra.json`:
- **Image**: `docker.io/acalculus/tokenomics-advisor-playground:latest`
- **Port**: 8080
- **GPU**: Required (4GB VRAM minimum)
- **Network**: Nosana nvidia-3090 market

## 🔧 Configuration

### Environment Variables
```env
# Required: AI Model API Keys
MISTRAL=your_mistral_api_key_here
GEMINI=your_gemini_api_key_here

# Optional: Model Selection
MM=mistral-large-latest          # Mistral model
GM=gemini-1.5-pro               # Gemini model

# Optional: Server Configuration
PORT=8080                       # Mastra playground port
MASTRA_DEV=true                # Development mode
```

### Model Configuration
The project supports multiple AI models:
- **Mistral**: `mistral-large-latest` (default)
- **Gemini**: `gemini-1.5-pro`
- **Custom**: Configure in `src/mastra/config.ts`

### Memory Configuration
- **Storage**: SQLite database
- **Features**: Persistent conversations, user preferences

## 🧪 Testing

### Test MCP Connection
```bash
# Test local MCP client
pnpm run mcp:client
```

### Validate Setup
1. **Check dependencies**: `pnpm install`
2. **Verify environment**: Check `.env` file
3. **Test build**: `pnpm run build`
4. **Test services**: `pnpm run dev`

## 🔍 Troubleshooting

### Common Issues

**API Key Issues**
- Verify API keys are set in `.env` file
- Check API key permissions and quotas
- Ensure environment variables are loaded correctly

**Memory Issues**
- Check database connection in `src/mastra/memory/.memory/`
- Verify `resourceId` and `threadId` are provided for context

**Build Errors**
- Update dependencies: `pnpm update`
- Clear build cache: `rm -rf .mastra/output`
- Check TypeScript configuration

### Debug Mode
Enable debug logging:
```bash
DEBUG=mastra:* pnpm run dev
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Follow code style**: `pnpm run format`
5. **Run tests**: `pnpm run check`
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Code Style
- Use TypeScript for all new code
- Follow existing patterns and conventions
- Add JSDoc comments for public APIs
- Include tests for new features

## 📜 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Mastra Framework**: For providing the AI agent infrastructure
- **CoinGecko API**: For cryptocurrency market data
- **Mobula API**: For token metadata and distribution data
- **Nosana Network**: For decentralized compute infrastructure
- **Model Context Protocol**: For standardized AI tool integration

## 📞 Support

- **Documentation**: [Mastra Docs](https://mastra.ai/docs)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Community**: [Discord Server](https://discord.gg/mastra)
- **Email**: support@example.com

## 🔗 Links

- **Docker Hub**: https://hub.docker.com/r/acalculus/tokenomics-advisor-playground
- **Mastra Framework**: https://mastra.ai/
- **Nosana Network**: https://nosana.io/
- **Model Context Protocol**: https://github.com/modelcontextprotocol/servers

---

**Built with ❤️ using Mastra Framework** 