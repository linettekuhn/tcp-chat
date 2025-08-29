#pragma once

#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>
#include <cstdint>
#include "./ErrorCodes.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <ctime>
#include <cctype>
#include <climits>
#include <cstring>

#define SOCKET int

namespace Utilities
{
    int RecieveSocketData(SOCKET socket, char* buffer, int length);
    int SendSocketData(SOCKET socket, const char* data, int length);
	int GetValidatedInt(const char* strMessage, const int& nMinimumRange = 0, const int& nMaximumRange = 0);
	char GetValidatedCommandChar(const char* strMessage);
	int GetMenuChoice(const std::vector<std::string>& menuOptions);
	std::vector<std::string> SplitString(const std::string& string, const char& delimiter = ' ');
	std::string GetHostInfo(uint16_t port);
	inline void ClearInputBuffer()
	{
		std::cin.clear();
		std::cin.ignore(INT_MAX, '\n');
	}
};