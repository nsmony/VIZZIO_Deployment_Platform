using System.Windows;

namespace Launcher
{
    // Legacy shell kept for WPF compatibility; the app now opens DownloadManagerWindow.
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
        }
    }
}
