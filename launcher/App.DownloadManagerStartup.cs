using System.Windows;

namespace Launcher
{
    public partial class App
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            var window = new DownloadManagerWindow();
            MainWindow = window;
            window.Show();
        }
    }
}
