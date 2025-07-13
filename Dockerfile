FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json pnpm-lock.yaml ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

# Copy source code and configuration files
COPY src/ ./src/
COPY tsconfig.json ./
COPY .env* ./

# Copy other necessary files
COPY nos_job_def/ ./nos_job_def/
COPY assets/ ./assets/
COPY *.md ./

# Build the Mastra project
RUN pnpm run build

# Expose the port for Mastra API
EXPOSE 8080

# Start the unified build command that runs both Mastra API and MCP server
CMD ["pnpm", "run", "dev"]

