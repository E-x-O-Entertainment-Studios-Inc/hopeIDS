# hopeIDS Test Server
FROM node:22-slim

LABEL maintainer="E.x.O. Entertainment Studios"
LABEL description="hopeIDS standalone test server"

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (none currently, but for future)
RUN npm install --production 2>/dev/null || true

# Copy source
COPY . .

# Make CLI executable
RUN chmod +x cli/hopeid.js
RUN ln -sf /app/cli/hopeid.js /usr/local/bin/hopeid

# Expose test server port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
    CMD curl -f http://localhost:3333/health || exit 1

# Run the test server
CMD ["node", "docker/server.js"]
