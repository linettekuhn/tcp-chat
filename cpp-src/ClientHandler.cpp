#include "ClientHandler.h"

int ClientHandler::init(uint16_t port, std::string address)
{
    // create client socket
    SOCKET clientSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (clientSocket == INVALID_SOCKET)
    {
        return SETUP_ERROR;
    }

    // create socket address
    sockaddr_in serverAddress;
    serverAddress.sin_family = AF_INET;
    serverAddress.sin_port = htons(port);

    if (inet_pton(AF_INET, address.c_str(), &serverAddress.sin_addr) <= 0)
    {
        close(clientSocket);
        return PARAMETER_ERROR;
    }

    // request connection to server
    if (connect(clientSocket, (sockaddr*)&serverAddress, sizeof(serverAddress)) == SOCKET_ERROR)
    {
        int error = errno;
        if (error == ECONNABORTED)
        {
            close(clientSocket);
            return SHUTDOWN;
        }
        close(clientSocket);
        return CONNECT_ERROR;
    }

    this->_clientSocket = clientSocket;
    std::string welcomeMessage = handleServer();
    if (welcomeMessage != "ERROR")
    {
        std::cout << welcomeMessage << std::endl;
    }
    this->_commandChar = welcomeMessage[welcomeMessage.size() - 2];
    return SUCCESS;
}

int ClientHandler::readMessage(SOCKET socket, char* buffer, int32_t size, int& lengthRead)
{
    // read message length (first byte)
    uint8_t length = 0;
    int byteRead = Utilities::RecieveSocketData(socket, (char*)&length, 1);
    if (byteRead < 1) return byteRead;
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

int ClientHandler::sendMessage(SOCKET socket, const char* data, int32_t length)
{
    if (length < 0 || length > 255) return PARAMETER_ERROR;

    // send the length as first byte
    uint8_t bLength = static_cast<uint8_t>(length);
    int byteSent = Utilities::SendSocketData(socket, (char*)&bLength, 1);
    if (byteSent < 1) return byteSent;

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

std::string ClientHandler::handleServer()
{
    // recieve message from server
    char buffer[256];
    int length = 0;
    int result = readMessage(_clientSocket, buffer, sizeof(buffer), length);
    if (result != SUCCESS)
    {
        return "ERROR";
    }
    else
    {
        return std::string(buffer, buffer + length);
    }
}

void ClientHandler::stop()
{
    if (_clientSocket != INVALID_SOCKET)
    {
        // close client socket
        shutdown(_clientSocket, SD_BOTH);
        close(_clientSocket);
        _clientSocket = INVALID_SOCKET;
    }
}