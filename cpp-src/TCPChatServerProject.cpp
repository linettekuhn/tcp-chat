#include "ChatServer.h"
#include "ClientHandler.h"
#include "Utilities.h"
#include "MessageHandler.h"
#include <mutex>
#include <thread>
#include <condition_variable>
#include <chrono>
#include <arpa/inet.h>
#include <unistd.h>
#include <errno.h>
#include <csignal>
#include <sys/socket.h>

#define SOCKET int
#define SOCKET_ERROR -1
#define INVALID_SOCKET -1

struct ThreadStruct
{
	int id = 0;								// thread number
	bool* run = nullptr;					// flag for detached threads to stop running
	int* threadCount = nullptr;				// number of threads
	std::mutex* mutex = nullptr;
	std::condition_variable* conditionVariable = nullptr;
};

void UDPThreadEntrypoint(ThreadStruct* threadData, ChatServer* server)
{
	std::mutex* mutex = threadData->mutex;
	std::condition_variable* cv = threadData->conditionVariable;
	uint16_t serverPort = server->getServerPort();

	// set up broadcast socket
	int broadcastSocket = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
	int optVal = 1;
	setsockopt(broadcastSocket, SOL_SOCKET, SO_BROADCAST, (const char*)&optVal, sizeof(optVal));

	// set up broadcast address
	sockaddr_in broadcastAddress;
	broadcastAddress.sin_family = AF_INET;
	broadcastAddress.sin_addr.s_addr = INADDR_BROADCAST;
	broadcastAddress.sin_port = htons(serverPort);

	// broadcast loop
	while (true)
	{
		std::string hostInfo = Utilities::GetHostInfo(serverPort);
		int bytesSent = sendto(broadcastSocket, hostInfo.c_str(), static_cast<int32_t>(hostInfo.size() + 1), 0, (sockaddr*)&broadcastAddress, sizeof(broadcastAddress));
		if (bytesSent == SOCKET_ERROR)
		{
			std::cout << "Error sending broadcast message: " << errno << std::endl;
		}

		std::this_thread::sleep_for(std::chrono::seconds(1));

		std::lock_guard<std::mutex> flagLock(*mutex);
		if (*(threadData->run) == false)
		{
			server->stop();
			break;
		}
	}

	close(broadcastSocket);

	// critical area !! threadCount
	std::lock_guard<std::mutex> countLock(*mutex);
	(*(threadData->threadCount))--;
	cv->notify_all();					// notify main to check if threadCount is 0
}

int main(int argc, char* argv[])
{
	if (argc < 3)
	{
		std::cerr << "Usage:" << std::endl;
		std::cerr << "  Server: " << argv[0] << " 0 <port> <capacity> <commandChar>" << std::endl;
		std::cerr << "  Client: " << argv[0] << " 1 <port> <serverAddress>" << std::endl;
		return -1;
	}
	int mode = atoi(argv[1]);
	if (mode < 0 || mode > 1)
	{
		std::cerr << "Mode out of allowed range (0-1)" << std::endl;
		return -1;
	}
	int port = atoi(argv[2]);
	if (port < 1 || port > 65535)
	{
		std::cerr << "Port out of allowed range (1-65535)" << std::endl;
		return -1;
	}

	bool active = false;
	std::mutex mutex;
	std::condition_variable conditionVariable;
	int threadCount = 1;

	ChatServer server;
	ClientHandler client;

	if (mode == 0) // Server Mode
	{
		if (argc != 5)
		{
			std::cerr << "Expected Arguments:" << std::endl;
			std::cerr << argv[0] << " 0 <port> <capacity> <commandChar>" << std::endl;
			return -1;
		}
		int capacity = atoi(argv[3]);
		if (capacity < 1 || capacity > 100)
		{
			std::cerr << "Capacity out of allowed range (1-100)" << std::endl;
			return -1;
		}
		char commandChar = *argv[4];

		// initialize per thread data
		ThreadStruct perThreadData;
		perThreadData.run = &active;
		perThreadData.threadCount = &threadCount;
		perThreadData.mutex = &mutex;
		perThreadData.conditionVariable = &conditionVariable;


		// initialize server
		if (server.init(port, commandChar, capacity) == SUCCESS)
		{
			active = true;
			signal(SIGPIPE, SIG_IGN);
			std::cout << "Server initalized!" << std::endl;
			std::cout << Utilities::GetHostInfo(port) << std::endl;

			// initialize UDP broacast thread
			std::thread udpThread = std::thread(UDPThreadEntrypoint, &perThreadData, &server);
			udpThread.detach();

            bool running = true;

            // server run loop
            while (running)
            {
                server.selectReadySockets();
				server.acceptConnection();
				running = server.handleClients();

				std::lock_guard<std::mutex> flagLock(mutex);
				if (running == false)
				{
					active = false;
					server.stop();
					std::cout << "Server was shutdown." << std::endl;
					break;
				}
			}
		} else {
			std::cerr << "(SERVER) Failed to initialize server." << std::endl;
			return 1;
		}

		// wait until all detached threads finish (threadCount reaches 0)
		std::unique_lock<std::mutex> lck(mutex);
		conditionVariable.wait(lck, [&]() { return (threadCount <= 0); });
	}
	else if (mode == 1) // Client
	{
		if (argc != 4)
		{
			std::cerr << "Expected Arguments:" << std::endl;
			std::cerr << argv[0] << " 0 <port> <address>" << std::endl;
			return -1;
		}
		char* address = argv[3];
		if (client.init(port, address) == SUCCESS)
		{
			active = true;
			signal(SIGPIPE, SIG_IGN);
			// client input loop
			while (true)
			{
				// command input
				std::string command;
				if (!std::getline(std::cin, command))
				{
					std::cout << "[DEBUG-EXIT] EOF on stdin" << std::endl;
					break;
				}

				// command validation
				MessageHandler msgHandler(command, client.getCommandChar());
				if (!msgHandler.ValidateInputCommand())
				{
					std::cout << "(SERVER) Invalid command!" << std::endl;
					continue;
				}
				std::string disconnectCmd = std::string(1, client.getCommandChar()) + "disconnect";
				if (command == disconnectCmd)
				{
					std::cout << "[DEBUG-EXIT] disconnect command" << std::endl;
					client.sendMessage(*(client.getSocket()), disconnectCmd.c_str(), static_cast<int32_t>(disconnectCmd.size() + 1));
					break;
				}

				if (client.sendMessage(*(client.getSocket()), command.c_str(), static_cast<int32_t>(command.size() + 1)) != SUCCESS)
				{
					std::cerr << "(SERVER) Send failed!" << std::endl;
				}
				std::string response = client.handleServer();
				if (response == "ERROR")
				{
					std::cout << "[DEBUG-EXIT] connection lost" << std::endl;
					std::cerr << "(SERVER) Connection with server lost!" << std::endl;
					break;
				}
				std::cout << response << std::endl;
			}

			client.stop();
			active = false;
			std::cout << "(SERVER) Client disconnected." << std::endl;
		}
		else
		{
			std::cerr << "(SERVER) Failed to connect to server." << std::endl;
			return -1;
		}
	}

	return 0;
}
