#include "ChatServer.h"
#include <cerrno>

#define SOCKET_ERROR -1
#define SD_BOTH SHUT_RDWR

int ChatServer::init(uint16_t port, char commandChar, int capacity)
{
    // create listening socket
    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket == INVALID_SOCKET)
    {
        return SETUP_ERROR;
    }

    // create socket address
    sockaddr_in serverAddress;
    serverAddress.sin_family = AF_INET;
    serverAddress.sin_addr.s_addr = INADDR_ANY;
    serverAddress.sin_port = htons(port);

    // bind address and port to socket
    if (bind(serverSocket, (sockaddr*)&serverAddress, sizeof(serverAddress)) == SOCKET_ERROR)
    {
        return BIND_ERROR;
    }

    // listen for incoming requests
    if (listen(serverSocket, 1) == SOCKET_ERROR)
    {
        return SETUP_ERROR;
    }

    // initialize sets and add listening socket
    FD_ZERO(&_masterSet);
    FD_SET(serverSocket, &_masterSet);
    FD_ZERO(&_readSet);
    _readSet = _masterSet;
    FD_ZERO(&_writeSet);
    _writeSet = _masterSet;

    this->_listeningSocket = serverSocket;
    this->_capacity = capacity;
    this->_commandChar = commandChar;
    this->_port = port;
    return SUCCESS;
}

int ChatServer::acceptConnection()
{
    // check if listening socket is ready to read
    if (FD_ISSET(_listeningSocket, &_readSet))
    {
        // accept connection and store in master set
        sockaddr_in clientAddress;
        socklen_t clientAddrLen = sizeof(clientAddress);
        SOCKET clientSocket = accept(_listeningSocket, (sockaddr*)&clientAddress, &clientAddrLen);
        if (clientSocket == INVALID_SOCKET)
        {
            int error = errno;
            if (error == ECONNABORTED)
            {
                return DISCONNECT;
            }
            return CONNECT_ERROR;
        }
        else
        {
            FD_SET(clientSocket, &_masterSet);
			_clients.push_back(clientSocket);
            std::string response = "Welcome to my server! Commands marked * require login. To use commands begin them with: " + std::string(1, _commandChar);
            sendMessage(clientSocket, response.c_str(), static_cast<int32_t>(response.size() + 1));
        }
    }
    return SUCCESS;
}

bool ChatServer::handleClients()
{
    std::vector<SOCKET> toRemove;

    // loop through clients 
    for (SOCKET s : _clients)
    {
        // skip if socket not ready to read or is listening socket
		if (!FD_ISSET(s, &_readSet)) continue;
		if (s == _listeningSocket) continue;

        char buffer[256];
        int length = 0;
        
        int result = readMessage(s, buffer, sizeof(buffer), length);
        if (result != SUCCESS)
        {
            shutdown(s, SD_BOTH);
            close(s);
            FD_CLR(s, &_masterSet);
            FD_CLR(s, &_readSet);
            FD_CLR(s, &_writeSet);
			toRemove.push_back(s);
            
            // remove closed socket from logged in users
            if (_socketToUsername.count(s))
            {
                std::string username = _socketToUsername[s];
                _loggedIn.erase(username);
                _socketToUsername.erase(s);
            }
            continue;
        }
        
        Logger cmdLogger("command_log.txt");
        cmdLogger.WriteLog(buffer);
            
        std::string message(buffer, buffer + length);
        message.erase(std::remove(message.begin(), message.end(), '\0'), message.end());
            
        MessageHandler msgHandler(message, _commandChar);
        std::string response;
        if (msgHandler.ValidateInputCommand() == false)
        {
            response = "(SERVER) Invalid command. Check " + std::string(1, _commandChar) + "help for the right syntax";
            sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
            continue;
        }
       
        std::string commandName = msgHandler.GetCommandName();
        if (commandName == "help") {
            response = "(SERVER) Available commands:\n" +
                std::string(1, _commandChar) + "help: list all cmds\n" +
                std::string(1, _commandChar) + "register <user> <pass>: create account\n" +
                std::string(1, _commandChar) + "login <user> <pass>: log in\n" +
                std::string(1, _commandChar) + "logout*: log out\n" +
                std::string(1, _commandChar) + "send* [<user>] \"msg\": send msg\n" +
                std::string(1, _commandChar) + "getlist*: online users\n" +
                std::string(1, _commandChar) + "getchatlog*: chat history\n" +
                std::string(1, _commandChar) + "getcmdlog*: command history ";
            sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
        }
        else if (commandName == "shutdown")
        {
            response = "(SERVER) Server was shutdown";
            sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
            return false;
        }
        else if (commandName == "register") {
            std::vector<std::string> params = msgHandler.GetCommandParameters();
            std::string username = params[0];
            std::string password = params[1];
            std::string response;

            if (_registered.size() >= _capacity)
            {
                response = "(SERVER) Server at capacity";
                sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
                continue;
            }

            if (_registered.find(username) == _registered.end())
            {
                _registered[username] = password;
                response = "(SERVER) User registered!";
            }
            else
            {
                response = "(SERVER) Username taken";
            }
            sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
        }
        else if (commandName == "login") {
            std::vector<std::string> params = msgHandler.GetCommandParameters();
            std::string username = params[0];
            std::string password = params[1];
            std::string response = "(SERVER) Invalid credentials";

            std::unordered_map<std::string, std::string>::iterator pair = _registered.find(username);

            // check if user is registered
            if (pair != _registered.end() && pair->first == username && pair->second == password)
            {
                // check if user is logged in
                if (_loggedIn.find(username) == _loggedIn.end())
                {
                    _loggedIn[username] = s;
                    _socketToUsername[s] = username;
                    response = "(SERVER) User logged in!";
                    Logger userLogger("active_users.txt");
                    userLogger.WriteLog(username);
                }
                else 
                {
                    response = "(SERVER) User already logged in";
                }
            }
            sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
        }
        // check if user is logged in for the following commands
        else if (_socketToUsername.find(s) != _socketToUsername.end())
        {
            if (commandName == "send") {
                std::vector<std::string> params = msgHandler.GetCommandParameters();
                std::string response;
                std::string sender = _socketToUsername[s];
                
                // direct messages
                if (params.size() > 1)
                {
                    std::string recipient = params[0];
                    std::string message = params[1];
                    message.erase(std::remove(message.begin(), message.end(), '"'), message.end());
                    std::string formattedMessage = sender + ": " + message;


                    if (_loggedIn.find(recipient) != _loggedIn.end())
                    {
                        SOCKET recipientSocket = _loggedIn[recipient];
                        sendMessage(recipientSocket, formattedMessage.c_str(), static_cast<int32_t>(formattedMessage.size() + 1));
                    }
                    else
                    {
                        response = "(SERVER) Recipient user not found";
                        sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
                    }
                }
                // public messages
                else
                {
                    std::string message = params[0];
                    message.erase(std::remove(message.begin(), message.end(), '"'), message.end());
                    std::string formattedMessage = sender + ": " + message;

                    Logger chatLogger("chat_log.txt");
                    chatLogger.WriteLog(formattedMessage);

                    for (auto iter = _loggedIn.begin(); iter != _loggedIn.end(); ++iter)
                    {
                        std::string username = iter->first;
                        SOCKET socket = iter->second;

                        if (FD_ISSET(socket, &_writeSet))
                        {
                            sendMessage(socket, formattedMessage.c_str(), static_cast<int32_t>(formattedMessage.size() + 1));
                        }
                    }
                }
            }
            else if (commandName == "logout" || commandName == "disconnect") {
                _loggedIn.erase(_socketToUsername[s]);
                _socketToUsername.erase(s);
                std::string response = "(SERVER) User logged out!";
                sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
                
                shutdown(s, SD_BOTH);
                close(s);
                FD_CLR(s, &_masterSet);
                FD_CLR(s, &_readSet);
                FD_CLR(s, &_writeSet);
            }
            else if (commandName == "getlist") {
                std::string response = "(SERVER) Logged in users:\n";
                for (auto iter = _loggedIn.begin(); iter != _loggedIn.end(); ++iter)
                {
                    std::string username = iter->first;
                    response += username + '\n';
                }
                if (response.empty())
                {
                    response = "(SERVER) No users logged in";
                }
                sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
            }
            else if (commandName == "getcmdlog" || commandName == "getchatlog") {
                std::ifstream logFile;
                std::string response;
                
                if (commandName == "getcmdlog")
                {
                    logFile.open("command_log.txt");
                }
                else
                {
                    logFile.open("chat_log.txt");
                }

                if (!logFile.is_open())
                {
                    response = "(SERVER) Failed to open command log file";
                    sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
                    continue;
                }

                // send log as chunks to be within send size limits
                std::string line;
                std::string chunk;
                int maxLength = 255;

                while (std::getline(logFile, line))
                {
                    // send off chunk when it passes max length
                    if (chunk.size() + line.size() + 1 > maxLength)
                    {
                        sendMessage(s, chunk.c_str(), static_cast<int32_t>(chunk.size() + 1));
                        chunk.clear();
                    }
                    chunk += line + '\n';
                }
                if (!chunk.empty())
                {
                    sendMessage(s, chunk.c_str(), static_cast<int32_t>(chunk.size() + 1));
                }
            }
        }
        else
        {
            std::string response = "(SERVER) User not logged in";
            sendMessage(s, response.c_str(), static_cast<int32_t>(response.size() + 1));
        }
    }
    
    
    for (SOCKET s : toRemove)
    {
		_clients.erase(std::remove(_clients.begin(), _clients.end(), s), _clients.end());
    }
    return true;
}

int ChatServer::readMessage(SOCKET socket, char* buffer, int32_t size, int& lengthRead)
{
    // read message length (first byte)
    uint8_t length = 0;
    int byteRead = Utilities::RecieveSocketData(socket, (char*)&length, 1);
    if (byteRead == SHUTDOWN || byteRead == DISCONNECT) return byteRead;
    if (length > size) return PARAMETER_ERROR;

    // keep recieving bytes until all bytes are read
    int bytesRecieved = 0;
    do
    {
        int bytesRead = Utilities::RecieveSocketData(socket, buffer + bytesRecieved, length - bytesRecieved);
        if (bytesRead < 1) return bytesRead;
        bytesRecieved += bytesRead;
    } while (bytesRecieved < length);

    lengthRead = length;
    return SUCCESS;
}

int ChatServer::sendMessage(SOCKET socket, const char* data, int32_t length)
{
    if (length < 0 || length > 255) return PARAMETER_ERROR;

    // send the length as first byte
    uint8_t bLength = static_cast<uint8_t>(length);
    int byteSent = Utilities::SendSocketData(socket, (char*)&bLength, 1);
    if (byteSent == SHUTDOWN || byteSent == DISCONNECT) return byteSent;

    // keep sending bytes until all bytes are sent
    int totalBytesSent = 0;
    do
    {
        int bytesSent = Utilities::SendSocketData(socket, data + totalBytesSent, length - totalBytesSent);
        if (bytesSent < 1) return bytesSent;
        totalBytesSent += bytesSent;
    } while (totalBytesSent < length);
    return SUCCESS;
}

int ChatServer::selectReadySockets()
{
    _readSet = _masterSet;
    _writeSet = _masterSet;

    timeval timeout;
    timeout.tv_sec = 0;
    timeout.tv_usec = 100000; // 100ms
    int highest_fd = _listeningSocket;
    for (SOCKET s : _clients)
    {
        if (s > _listeningSocket)
        {
			highest_fd = s;
        }
    }
    int result = select(highest_fd + 1, &_readSet, &_writeSet, NULL, &timeout);
    if (result < 0)
    {
        return SELECT_ERROR;
    }
    else
    {
        return SUCCESS;
    }
}

void ChatServer::stop()
{
    // shutdown and close listening socket
    shutdown(_listeningSocket, SD_BOTH);
    close(_listeningSocket);

    // shutdown and close each socket
    for (SOCKET s : _clients)
    {
        shutdown(s, SD_BOTH);
        close(s);
    }
    _clients.clear();
    // clear master set
    FD_ZERO(&_masterSet);
    // clear logs
    std::ofstream logFile("command_log.txt", std::ios::trunc);
    logFile.close();
    logFile.open("chat_log.txt", std::ios::trunc);
    logFile.close();
    logFile.open("active_users.txt", std::ios::trunc);
    logFile.close();
}
