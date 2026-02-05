# Moltbook Threat Scanner with hopeIDS
FROM node:22-slim

LABEL maintainer="E.x.O. Entertainment Studios"
LABEL description="Moltbook threat scanner with hopeIDS and auto-updating patterns"

# Install curl for health checks and git for pattern updates
RUN apt-get update && \
    apt-get install -y curl git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install hopeIDS globally first
RUN npm install -g hopeid@latest

# Copy pattern update script
COPY update-patterns.sh /usr/local/bin/update-patterns
RUN chmod +x /usr/local/bin/update-patterns

# Copy scanner files
COPY package*.json ./
RUN npm install --production

# Copy source files
COPY . .

# Create data directory for persistence
RUN mkdir -p /app/data

# Expose server port
EXPOSE 3457

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
    CMD curl -f http://localhost:3457/api/health || exit 1

# Run pattern update on start, then start the server
CMD /usr/local/bin/update-patterns && node server.js
