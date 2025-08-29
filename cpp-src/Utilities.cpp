#include "Utilities.h"
#include <cerrno>

int Utilities::RecieveSocketData(SOCKET socket, char* buffer, int length)
{
    int result = 0;
    result = recv(socket, buffer, length, 0);
    // error checking
    if (result == 0) return SHUTDOWN;
    if (result < 1)
    {
        int error = errno;
        if (error == EPIPE || error == ECONNRESET || error == ENOTCONN)
        {
            return SHUTDOWN;
        }
        return DISCONNECT;
    }
    return result;
}

int Utilities::SendSocketData(SOCKET socket, const char* data, int length)
{
    int result = 0;
    result = send(socket, data, length, 0);
    // error checking
    if (result == 0) return SHUTDOWN;
    if (result < 1)
    {
        int error = errno;
        if (error == EPIPE || error == ECONNRESET || error == ENOTCONN)
        {
            return SHUTDOWN;
        }
        return DISCONNECT;
    }
    return result;
}

int Utilities::GetValidatedInt(const char* strMessage, const int& nMinimumRange, const int& nMaximumRange)
{
	int num;
	do
	{
		// display the provided message to the screen then use cin to get an int from the user
		std::cout << strMessage;
		std::cin >> num;
		if (std::cin.fail()) // error checking
		{
			std::cout << "Invalid number! ";
			ClearInputBuffer();
		}
		else
		{
			ClearInputBuffer();
			if (nMinimumRange == 0 && nMaximumRange == 0) // range check should be ignored if BOTH the minimum and maximum parameters are 0
			{
				return num;
			}
			if (num >= nMinimumRange && num <= nMaximumRange)
			{
				return num;
			}
			else
			{
				std::cout << "Number outside of range! ";
			}
		}
	} while (true);
}

char Utilities::GetValidatedCommandChar(const char* strMessage)
{
	char commandChar;
	std::string input;
	do
	{
		// display the provided message to the screen then use cin to get an int from the user
		std::cout << strMessage;
		std::getline(std::cin, input);
		if (input.empty())
		{
			return '~';
		}
		if (input.length() != 1)
		{
			std::cout << "Must be a single character! ";
		}
		else
		{
			commandChar = input[0];
			if (std::isalnum(commandChar))
			{
				std::cout << "Cannot be a letter or number! ";
			}
			else
			{
				return commandChar;
			}
		}
	} while (true);
}

int Utilities::GetMenuChoice(const std::vector<std::string>& menuOptions)
{
	std::cout << std::endl;
	int amountOfOptions = (int)menuOptions.size();
	for (int i = 0; i < amountOfOptions; i++)
	{
		std::cout << i + 1 << ". " << menuOptions[i] << '\n';
	}
	std::cout << std::endl;
	return GetValidatedInt("Pick a choice: ", 1, amountOfOptions);
}

std::vector<std::string> Utilities::SplitString(const std::string& string, const char& delimiter)
{
	std::vector<std::string> result;
	std::string token;
	bool inMessage = false;

	for (size_t i = 0; i < string.size(); i++)
	{
		char c = string[i];

		if (c == '"')
		{
			inMessage = !inMessage;
			token += c;
		}
		else if (c == delimiter && !inMessage)
		{
			if (!token.empty())
			{
				result.push_back(token);
				token = "";
			}
		}
		else
		{
			token += c;
		}
	}
	if (!token.empty())
	{
		result.push_back(token);
	}
	return result;
}

std::string Utilities::GetHostInfo(uint16_t port)
{
	char hostname[256];
	gethostname(hostname, sizeof(hostname));
	
	addrinfo hints, * res, * p;
	char ipstr[INET6_ADDRSTRLEN];
		
	memset(&hints, 0, sizeof hints);
	hints.ai_family = AF_UNSPEC;
	hints.ai_socktype = SOCK_STREAM;

	std::string sPort = std::to_string(port);

	getaddrinfo(hostname, sPort.c_str(), &hints, &res);
	std::ostringstream output;
	output << "Server Hostname:" << hostname << '\n';
	output << "Server listening on:\n";
	
	for (p = res; p != NULL; p = p->ai_next) {
		void* addr;
		std::string ip_version;
		uint16_t currentPort;

		if (p->ai_family == AF_INET) {
			sockaddr_in* ipv4 = (sockaddr_in*)p->ai_addr;
			addr = &(ipv4->sin_addr);
			currentPort = ntohs(ipv4->sin_port);
			ip_version = "IPv4";
		}
		else if (p->ai_family == AF_INET6) {
			sockaddr_in6* ipv6 = (sockaddr_in6*)p->ai_addr;
			addr = &(ipv6->sin6_addr);
			currentPort = ntohs(ipv6->sin6_port);
			ip_version = "IPv6";
		}
		else {
			continue;
		}

		inet_ntop(p->ai_family, addr, ipstr, sizeof ipstr);
		output << '\t' << ip_version << " Address: " << ipstr << " Port: " << currentPort << std::endl;
	}

	freeaddrinfo(res);
	return output.str();
}