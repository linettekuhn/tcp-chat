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

# Build C++ server
RUN mkdir -p build && cd build && cmake .. && make && chmod +x TCPChatServer

# Mark as executable
RUN chmod +x backend/bin/TCPChatServer

# Install Node.js dependencies
RUN cd backend && npm install

# Expose port your Node server uses
EXPOSE 3000

# Start Node.js server
CMD ["node", "backend/index.js"]
