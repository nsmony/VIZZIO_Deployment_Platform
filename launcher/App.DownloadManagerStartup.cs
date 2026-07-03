using System.Windows;

namespace Launcher
{
    public partial class App
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // Start the download manager window as the launcher entry screen.
            var window = new DownloadManagerWindow();
            MainWindow = window;
            window.Show();
        }
    }
}
