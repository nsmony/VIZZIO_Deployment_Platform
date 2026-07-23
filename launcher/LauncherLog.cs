using System;
using System.Diagnostics;
using System.IO;

namespace Launcher
{
    internal static class LauncherLog
    {
        private static readonly object Sync = new();
        private static readonly string LogPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "VIZZIO",
            "Launcher",
            "launcher.log");

        public static void Info(string message)
        {
            var line = $"{DateTimeOffset.Now:O} {message}";
            Debug.WriteLine(line);

            try
            {
                lock (Sync)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
                    File.AppendAllText(LogPath, line + Environment.NewLine);
                }
            }
            catch
            {
                // Logging must never interrupt downloads.
            }
        }

        public static string GetLogPath()
        {
            return LogPath;
        }
    }
}
