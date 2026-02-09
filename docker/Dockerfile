FROM node:20-slim

# Install Python, common tools, and Agent SDK dependencies (git, ripgrep)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    git \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI (required by Agent SDK)
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy runner and MCP server
COPY runner.js ./
COPY mcp-mail-server.js ./

# Create directories
RUN mkdir -p /inbox /outbox /state /logs /workspace

CMD ["node", "runner.js"]
