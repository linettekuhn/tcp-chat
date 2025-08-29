#include "MessageHandler.h"

MessageHandler::MessageHandler(std::string command, char commandChar) : _command(command), _commandChar(commandChar)
{
	_tokens = Utilities::SplitString(command);
	if (!_tokens.empty() && !_tokens[0].empty() && _tokens[0][0] == _commandChar)
	{
		_commandName = _tokens[0].substr(1);
	}
	else
	{
		_commandName = "";
	}
}

bool MessageHandler::ValidateInputCommand()
{
	if (_tokens.empty())
	{
		return false;
	}

	// check if command begins with correct character
	if (_tokens[0][0] != _commandChar)
	{
		return false;
	}
	
	// check if command name is valid
	std::string commandName = _tokens[0].substr(1); 
	if (std::find(validCommands.begin(), validCommands.end(), commandName) == validCommands.end())
	{
		return false;
	}

	// check parameter count
	if (_tokens.size() > 3) return false;
	if (commandName == "help" || commandName == "logout" || commandName == "getlist" ||
		commandName == "getchatlog" || commandName == "getcmdlog" || commandName == "shutdown" || commandName == "disconnect")
	{
		if (_tokens.size() != 1) return false; // command + no params
	}
	else if (commandName == "register" || commandName == "login")
	{
		if (_tokens.size() != 3) return false; // command + 2 params
	}
	else if (commandName == "send")
	{
		if (_tokens.size() < 2) return false; // command + 1 or 2 params

		// check for recipient optional parameter
		std::string message;
		if (_tokens.size() == 2)
		{
			message = _tokens[1];
		}
		else
		{
			message = _tokens[2];
		}

		// check if message if formatted correctly
		if (message.front() != '"' || message.back() != '"')
		{
			return false;
		}
	}
	
	return true;
}

std::vector<std::string> MessageHandler::GetCommandParameters()
{
	std::vector<std::string> params;
	
	// no parameter 
	if (_commandName == "help" || _commandName == "logout" || _commandName == "getlist" ||
		_commandName == "getchatlog" || _commandName == "getcmdlog" || _tokens.size() > 3)
	{
		return params;
	}
	// 2 parameters 
	else if (_commandName == "register" || _commandName == "login")
	{
		params.push_back(_tokens[1]);
		params.push_back(_tokens[2]);
	}
	// 2 parameters (1 optional)
	else if (_commandName == "send")
	{
		// check for recipient optional parameter
		params.push_back(_tokens[1]);
		if (_tokens.size() == 3)
		{
			params.push_back(_tokens[2]);
		}
	}
	return params;
}
