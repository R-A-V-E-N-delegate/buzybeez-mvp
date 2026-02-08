FROM node:20-slim

# Install Python and common tools for bee code execution
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy runner code
COPY runner.js ./

# Create directories
RUN mkdir -p /inbox /outbox /state /logs /workspace

CMD ["node", "runner.js"]
