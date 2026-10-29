
using DDAAPI.Services;

namespace DDAAPI.Services
{
    public interface Log
    {
      

   
        public static void Error(string? userId, string? message,string FolderName)

        {
            string logEntry = "{" + $"Date: {DateTime.Now:yyyy-MM-dd HH:mm:ss} ~|~  User Id: {userId}  ~|~ Message: {message}" + "},";

            string logFilePath = Path.Combine($"Logs", $"ErrorLog", $"{FolderName}", $"{FolderName}{DateTime.Now:yyyy-MM-dd}.txt");

            if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))

            {

                Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));

            }

            try

            {
                using (StreamWriter writer = System.IO.File.AppendText($"Logs/ErrorLog/{FolderName}/{FolderName}{DateTime.Now:yyyy-MM-dd}.txt"))

                {

                    writer.WriteLine(logEntry);

                }

            }

            catch (Exception ex)

            {

                Console.WriteLine($"Error logging login attempt: {ex.Message}");

            }

        }
        public static void DataLog(string? userId, string? message,string? FolderName)

        {
            string logEntry = "{" + $"Date: {DateTime.Now:yyyy-MM-dd HH:mm:ss} ~|~  User Id: {userId}  ~|~ Message: {message}" + "},";

            string logFilePath = Path.Combine($"Logs", $"{FolderName}", $"{FolderName}{DateTime.Now:yyyy-MM-dd}.txt");

            if (!Directory.Exists(Path.GetDirectoryName(logFilePath)))

            {

                Directory.CreateDirectory(Path.GetDirectoryName(logFilePath));

            }

            try

            {
                using (StreamWriter writer = System.IO.File.AppendText($"Logs/{FolderName}/{FolderName}{DateTime.Now:yyyy-MM-dd}.txt"))

                {

                    writer.WriteLine(logEntry);

                }

            }

            catch (Exception ex)

            {

                Console.WriteLine($"Error logging login attempt: {ex.Message}");

            }

        }
    }
}
