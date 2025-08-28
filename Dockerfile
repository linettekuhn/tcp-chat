# Base image
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    nodejs npm g++ cmake make \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy project files
COPY . .

# Build C++ server directly in backend/bin
RUN mkdir -p backend/bin && cd backend/bin && cmake ../../ && make && chmod +x TCPChatServer

# Install Node.js dependencies
RUN cd backend && npm install

# Expose port your Node server uses
EXPOSE 3000

# Start Node.js server
CMD ["node", "backend/index.js"]
