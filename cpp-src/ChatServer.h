#pragma once
#include "Utilities.h"
#include "ErrorCodes.h"
#include "Logger.h"
#include "MessageHandler.h"
#include <unordered_map>
#include <algorithm>
#include <sys/select.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

#define SOCKET int
#define INVALID_SOCKET -1

class ChatServer
{
private:
    SOCKET _listeningSocket = INVALID_SOCKET;
    fd_set _masterSet = {};
    fd_set _readSet = {};
    fd_set _writeSet = {};
    std::vector<SOCKET> _clients;
    uint16_t _port = 0;
    char _commandChar = '~';
    int _capacity = 0;
    std::unordered_map<std::string, std::string> _registered{};
    std::unordered_map<std::string, SOCKET> _loggedIn{};
    std::unordered_map<SOCKET, std::string> _socketToUsername{};
public:
    SOCKET* getServerSocket() { return &_listeningSocket; }
    uint16_t getServerPort() { return _port; }
    int init(uint16_t port, char commandChar, int capacity);
    int acceptConnection();
    bool handleClients();
    int readMessage(SOCKET socket, char* buffer, int32_t size, int& lengthRead);
    int sendMessage(SOCKET socket, const char* data, int32_t length);
    int selectReadySockets();
    void stop();
};