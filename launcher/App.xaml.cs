using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace Launcher
{
    public partial class App : Application
    {
        public App()
        {
            // Register global error handlers before any window is shown.
            DispatcherUnhandledException += OnDispatcherUnhandledException;
            AppDomain.CurrentDomain.UnhandledException += (_, e) => LogException(e.ExceptionObject as Exception);
            TaskScheduler.UnobservedTaskException += (_, e) =>
            {
                LogException(e.Exception);
                e.SetObserved();
            };
        }

        private static void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
        {
            // Show a friendly message and write the full error to disk.
            LogException(e.Exception);
            MessageBox.Show(
                $"The launcher could not continue. Details were written to:\n{GetLogPath()}\n\n{e.Exception.Message}",
                "VIZZIO Launcher",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            e.Handled = true;
            Current.Shutdown(1);
        }

        private static void LogException(Exception? exception)
        {
            if (exception is null) return;

            try
            {
                var path = GetLogPath();
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.AppendAllText(path, $"[{DateTimeOffset.Now:O}] {exception}\n\n");
            }
            catch
            {
                // Avoid recursive startup failures if logging is unavailable.
            }
        }

        private static string GetLogPath()
        {
            // Store logs under the current Windows user profile.
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "VIZZIO",
                "Launcher",
                "launcher.log");
        }
    }
}
