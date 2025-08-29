#pragma once
#include <string>
#include <vector>
#include <algorithm>
#include "Utilities.h"
class MessageHandler
{
private:
	std::string _command = "";
	char _commandChar = '~';
	std::string _commandName = "";
	std::vector<std::string> _tokens = {};

	std::vector<std::string> validCommands ={"help", 
											"register", 
											"login",
											"send", 
											"logout", 
											"getlist", 
											"getchatlog", 
											"getcmdlog",
											"shutdown",
											"disconnect"};
public:
	MessageHandler(std::string command, char commandChar);
	bool ValidateInputCommand();
	std::vector<std::string> GetCommandParameters();
	std::string GetCommandName() { return _commandName; }
};

