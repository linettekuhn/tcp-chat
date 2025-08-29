#pragma once
#include <string>
#include <fstream>
#include <ctime>

class Logger
{
private:
	std::string _fileName = "";
	
public:
	Logger(std::string fileName);
	void WriteLog(std::string text);
};

