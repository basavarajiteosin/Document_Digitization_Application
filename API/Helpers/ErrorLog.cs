//using System;
//using System.Text;
//using System.Text.RegularExpressions;
//namespace DDAAPI.Helpers
//{
//    public class ErrorLog
//    {
//        public static void AddErrorLog(string type, string status)
//        {
//            type = MaskEmails(type);
//            status = MaskEmails(status);
//            string logEntry = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - {type} - {status}";

//            try
//            {

//                string logDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Logs", "ErrorLogs");
//                string logFileName = $"{DateTime.Now:yyyyMMdd}.log.txt";
//                string logFilePath = Path.Combine(logDirectory, logFileName);

//                // Ensure the directory exists
//                if (!Directory.Exists(logDirectory))
//                {
//                    Directory.CreateDirectory(logDirectory);
//                }

//                // Write to the log file
//                using (StreamWriter writer = new StreamWriter(logFilePath, true))
//                {
//                    writer.WriteLine(logEntry);
//                }

//                // Delete log files older than 15 days
//                CleanupOldLogs(logDirectory);
//            }
//            catch (Exception ex)
//            {
//                // Handle the exception (e.g., log it or take appropriate action)
//                Console.WriteLine($"Error writing to log file: {ex.Message}");
//            }
//        }



//        public static void AddMailErrorLog(string type, string status)
//        {
//            string logEntry = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - {type} - {status}";

//            try
//            {

//                // Define the log directory and file name
//                string logDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Logs", "MailErrorLog");
//                string logFileName = $"{DateTime.Now:yyyyMMdd}.log.txt";
//                string logFilePath = Path.Combine(logDirectory, logFileName);

//                // Ensure the directory exists
//                if (!Directory.Exists(logDirectory))
//                {
//                    Directory.CreateDirectory(logDirectory);
//                }

//                // Write to the log file
//                using (StreamWriter writer = new StreamWriter(logFilePath, true))
//                {
//                    writer.WriteLine(logEntry);
//                }

//                // Delete log files older than 15 days
//                CleanupOldLogs(logDirectory);
//            }
//            catch (Exception ex)
//            {
//                // Handle the exception (e.g., log it or take appropriate action)
//                Console.WriteLine($"Error writing to log file: {ex.Message}");
//            }
//        }

//        private static void CleanupOldLogs(string logDirectory)
//        {
//            try
//            {
//                // Get all log files in the directory
//                var logFiles = Directory.GetFiles(logDirectory, "*.log.txt");
//                DateTime expirationDate = DateTime.Now.AddDays(-15);

//                foreach (var logFile in logFiles)
//                {
//                    // Check if the file is older than 15 days
//                    if (File.GetLastWriteTime(logFile) < expirationDate)
//                    {
//                        File.Delete(logFile); // Delete the old log file
//                    }
//                }
//            }
//            catch (Exception ex)
//            {
//                // Handle cleanup errors
//                Console.WriteLine($"Error cleaning up old logs: {ex.Message}");
//            }
//        }

//        private static string MaskEmails(string input)
//        {
//            // Regular expression to match email addresses
//            string pattern = @"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b";

//            // MatchEvaluator function to mask each matched email
//            MatchEvaluator evaluator = new MatchEvaluator(match =>
//            {
//                string email = match.ToString();
//                return MaskEmail(email); // Call a helper function to mask the email
//            });

//            // Replace email addresses in the input string using the MatchEvaluator
//            return Regex.Replace(input, pattern, evaluator);
//        }

//        // Helper function to mask a single email address
//        private static string MaskEmail(string email)
//        {
//            string[] parts = email.Split('@');
//            if (parts.Length == 2)
//            {
//                string name = parts[0];
//                string domain = parts[1];

//                // Masking logic for the name part
//                StringBuilder maskedName = new StringBuilder();
//                for (int i = 0; i < name.Length; i++)
//                {
//                    if (i == 0 || i == name.Length - 1 || i % 2 == 0)
//                    {
//                        maskedName.Append(name[i]); // Keep first, last, and every 2nd character visible
//                    }
//                    else
//                    {
//                        maskedName.Append("*"); // Mask other characters
//                    }
//                }

//                // Masking logic for the domain part
//                StringBuilder maskedDomain = new StringBuilder();
//                for (int j = 0; j < domain.Length; j++)
//                {
//                    if (j < 2 || j >= domain.Length - 2 || j % 2 == 0)
//                    {
//                        maskedDomain.Append(domain[j]); // Keep first 2, last 2, and every 2nd character visible
//                    }
//                    else
//                    {
//                        maskedDomain.Append("*"); // Mask other characters
//                    }
//                }

//                return $"{maskedName.ToString()}@{maskedDomain.ToString()}";
//            }

//            return email; // Return original email if it doesn't match expected format
//        }




//    }
//}