#pragma once
#include "./Utilities.h"
#include "./ErrorCodes.h"
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cerrno>

#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define SD_BOTH SHUT_RDWR

class ClientHandler
{
private:
    SOCKET _clientSocket = INVALID_SOCKET;
    char _commandChar = '~';

public:
    int init(uint16_t port, std::string address);
    int readMessage(SOCKET socket, char* buffer, int32_t size, int& lengthRead);
    int sendMessage(SOCKET socket, const char* data, int32_t length);
    std::string handleServer();
    std::string handleServerAll();
    void stop();
    SOCKET* getSocket() { return &_clientSocket; }
    char getCommandChar() { return _commandChar; }
};