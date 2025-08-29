#include "Logger.h"

Logger::Logger(std::string fileName): _fileName(fileName)
{
}

void Logger::WriteLog(std::string text)
{
	// get time and convert to char array
	time_t timestamp = time(NULL);
	struct tm datetime;
	localtime_r(&timestamp, &datetime);
	char outputTime[50];
	strftime(outputTime, 50, "[%a %b %e %Y %I:%M:%S %p] ", &datetime);

	// output to file
	std::ofstream logFile(_fileName, std::ios::app);
	logFile << outputTime << text << '\n';
	logFile.close();
}