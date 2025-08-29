cmake_minimum_required(VERSION 3.15)

# Project name
project(TCPChatServer)

# Use C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# List of all source files
set(SOURCES
    TCPChatServerProject.cpp
    ChatServer.cpp
    ClientHandler.cpp
    Logger.cpp
    MessageHandler.cpp
    Utilities.cpp
)

# Create the executable
add_executable(TCPChatServer ${SOURCES})
