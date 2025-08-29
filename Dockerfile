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

# DEBUG: Check if binary was actually created
RUN echo "=== BUILD STAGE DEBUG ===" && ls -la /usr/src/app/build/

# 2) Runtime image for backend
FROM ubuntu:22.04

# Install runtime dependencies for Node.js
RUN apt-get update && apt-get install -y \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /opt/render/project/src/backend

# Copy the Node.js backend files and the compiled C++ binary from the builder stage
COPY backend .
COPY --from=builder /usr/src/app/build/TCPChatServer ./bin/TCPChatServer
RUN chmod +x ./bin/TCPChatServer

# DEBUG: Check what actually got copied
RUN echo "=== RUNTIME STAGE DEBUG ===" && \
    echo "Contents of working directory:" && ls -la && \
    echo "Contents of bin directory:" && ls -la bin/ || echo "bin directory doesn't exist" && \
    echo "Looking for binary:" && find . -name "*TCPChatServer*" -type f || echo "No TCPChatServer found"


# Install Node.js dependencies
RUN npm install

# Expose port
EXPOSE 3000

# Start Node.js server
CMD ["node", "index.js"]
