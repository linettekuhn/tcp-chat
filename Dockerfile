# 1) Build image for the C++ server using CMake
FROM ubuntu:22.04 as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    g++ cmake make \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy the C++ source files
COPY cpp-src ./cpp-src

# Configure and build the C++ project
RUN cmake -S ./cpp-src -B ./build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build ./build --target TCPChatServer
# After the build step, add this line to verify the binary exists:
RUN ls -la /usr/src/app/build/

# 2) Runtime image for backend
FROM ubuntu:22.04

# Install runtime dependencies for Node.js
RUN apt-get update && apt-get install -y \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /opt/render/project/src

# Copy the Node.js backend files and the compiled C++ binary from the builder stage
COPY backend ./backend
COPY --from=builder /usr/src/app/build/TCPChatServer backend/bin/TCPChatServer
RUN chmod +x ./backend/bin/TCPChatServer

# Install Node.js dependencies
RUN cd backend && npm install

# Expose port
EXPOSE 3000

# Start Node.js server
CMD ["node", "backend/index.js"]
