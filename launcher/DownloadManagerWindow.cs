using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;

namespace Launcher
{
    public sealed class DownloadManagerWindow : Window
    {
        private readonly DownloadManagerApiClient _api = new();
        private readonly ChunkedDownloadManager _downloader = new();
        private readonly ObservableCollection<DownloadItem> _items = new();
        private readonly ManualResetEventSlim _pauseGate = new(true);
        private CancellationTokenSource? _downloadCancellation;
        private ListBox _list = null!;
        private ProgressBar _progress = null!;
        private TextBlock _status = null!;
        private TextBlock _metrics = null!;
        private TextBox _installPath = null!;
        private Button _startButton = null!;
        private Button _pauseButton = null!;

        public DownloadManagerWindow()
        {
            Title = "VIZZIO Launcher";
            Width = 980;
            Height = 680;
            MinWidth = 860;
            MinHeight = 560;
            ShowLogin();
        }

        private void ShowLogin()
        {
            var username = new TextBox { Margin = new Thickness(0, 4, 0, 12), Height = 34 };
            var password = new PasswordBox { Margin = new Thickness(0, 4, 0, 12), Height = 34 };
            var server = new TextBox { Text = _api.ApiBaseUrl, Margin = new Thickness(0, 4, 0, 12), Height = 34 };
            var message = new TextBlock { Margin = new Thickness(0, 8, 0, 0), TextWrapping = TextWrapping.Wrap };
            var button = new Button { Content = "Sign in", Height = 38, Width = 120 };

            var panel = new StackPanel { Width = 380, VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Center };
            panel.Children.Add(new TextBlock { Text = "VIZZIO Download Manager", FontSize = 28, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 24) });
            panel.Children.Add(new TextBlock { Text = "Server URL" });
            panel.Children.Add(server);
            panel.Children.Add(new TextBlock { Text = "Username" });
            panel.Children.Add(username);
            panel.Children.Add(new TextBlock { Text = "Password" });
            panel.Children.Add(password);
            panel.Children.Add(button);
            panel.Children.Add(message);
            Content = panel;

            button.Click += async (_, _) =>
            {
                try
                {
                    button.IsEnabled = false;
                    message.Text = "Signing in...";
                    _api.ApiBaseUrl = server.Text.Trim();
                    await _api.LoginAsync(username.Text.Trim(), password.Password, CancellationToken.None);
                    await LoadItemsAsync();
                    ShowManager();
                }
                catch (Exception ex)
                {
                    message.Text = ex.Message;
                }
                finally
                {
                    button.IsEnabled = true;
                }
            };
        }

        private async Task LoadItemsAsync()
        {
            _items.Clear();
            var response = await _api.GetDownloadItemsAsync(CancellationToken.None);
            foreach (var item in response.Items)
            {
                _items.Add(item);
            }
        }

        private void ShowManager()
        {
            _list = new ListBox { ItemsSource = _items, MinWidth = 320, Margin = new Thickness(0, 0, 16, 0) };
            _progress = new ProgressBar { Minimum = 0, Maximum = 100, Height = 26 };
            _status = new TextBlock { Text = "Select a deployment to download.", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 12, 0, 0) };
            _metrics = new TextBlock { Text = "Speed: -   ETA: -", Margin = new Thickness(0, 8, 0, 0) };
            _installPath = new TextBox { Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Vizzio", "packages"), Height = 32 };
            _startButton = new Button { Content = "Start download", Height = 36, Width = 130, Margin = new Thickness(0, 16, 8, 0) };
            _pauseButton = new Button { Content = "Pause", Height = 36, Width = 90, Margin = new Thickness(0, 16, 8, 0), IsEnabled = false };
            var cancelButton = new Button { Content = "Cancel", Height = 36, Width = 90, Margin = new Thickness(0, 16, 0, 0), IsEnabled = true };
            var refreshButton = new Button { Content = "Refresh", Height = 32, Width = 90 };

            var right = new StackPanel();
            right.Children.Add(new TextBlock { Text = "Install folder" });
            right.Children.Add(_installPath);
            right.Children.Add(new TextBlock { Text = "Download progress", Margin = new Thickness(0, 20, 0, 8) });
            right.Children.Add(_progress);
            right.Children.Add(_metrics);
            right.Children.Add(_status);

            var buttons = new StackPanel { Orientation = Orientation.Horizontal };
            buttons.Children.Add(_startButton);
            buttons.Children.Add(_pauseButton);
            buttons.Children.Add(cancelButton);
            right.Children.Add(buttons);

            var header = new DockPanel { Margin = new Thickness(0, 0, 0, 16) };
            header.Children.Add(new TextBlock { Text = "Available deployments", FontSize = 24, FontWeight = FontWeights.SemiBold });
            DockPanel.SetDock(refreshButton, Dock.Right);
            header.Children.Add(refreshButton);

            var body = new Grid();
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(360) });
            body.ColumnDefinitions.Add(new ColumnDefinition());
            Grid.SetColumn(_list, 0);
            Grid.SetColumn(right, 1);
            body.Children.Add(_list);
            body.Children.Add(right);

            var root = new DockPanel { Margin = new Thickness(24) };
            DockPanel.SetDock(header, Dock.Top);
            root.Children.Add(header);
            root.Children.Add(body);
            Content = root;

            _startButton.Click += async (_, _) => await StartDownloadAsync();
            _pauseButton.Click += (_, _) => TogglePause();
            cancelButton.Click += async (_, _) => await CancelDownloadAsync();
            refreshButton.Click += async (_, _) => await RefreshAsync();
        }

        private async Task StartDownloadAsync()
        {
            if (_list.SelectedItem is not DownloadItem item)
            {
                _status.Text = "Choose a deployment first.";
                return;
            }

            if (!item.Available)
            {
                _status.Text = "This deployment version does not have a readable package file on the server.";
                return;
            }

            try
            {
                _startButton.IsEnabled = false;
                _pauseButton.IsEnabled = true;
                _pauseGate.Set();
                _downloadCancellation = new CancellationTokenSource();
                _status.Text = "Creating download session...";
                var session = await _api.CreateSessionAsync(item, _downloadCancellation.Token);
                var fileName = string.IsNullOrWhiteSpace(session.File.Name) ? item.FileName : session.File.Name;
                var targetPath = Path.Combine(_installPath.Text.Trim(), fileName);
                var uri = _api.BuildFileUri(item.FileId, session.Token);

                var progress = new Progress<DownloadProgress>(value =>
                {
                    _progress.Value = value.Percent;
                    _metrics.Text = $"Speed: {FormatBytes((long)value.BytesPerSecond)}/s   ETA: {value.Eta:mm\\:ss}   {FormatBytes(value.DownloadedBytes)} / {FormatBytes(value.TotalBytes)}";
                    _ = _api.UpdateSessionAsync(session.Session.Id, "downloading", value.DownloadedBytes, value.TotalBytes, CancellationToken.None);
                });

                _status.Text = "Downloading...";
                await _downloader.DownloadAsync(uri, targetPath, session.File.Size, item.Checksum, progress, _pauseGate, _downloadCancellation.Token);
                await _api.UpdateSessionAsync(session.Session.Id, "completed", session.File.Size, session.File.Size, CancellationToken.None);
                _progress.Value = 100;
                _status.Text = $"Download complete: {targetPath}";
            }
            catch (OperationCanceledException)
            {
                _status.Text = "Download canceled. Start again to resume from existing part files.";
            }
            catch (Exception ex)
            {
                _status.Text = ex.Message;
                MessageBox.Show(ex.Message, "Download failed", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            finally
            {
                _startButton.IsEnabled = true;
                _pauseButton.IsEnabled = false;
                _pauseButton.Content = "Pause";
            }
        }

        private void TogglePause()
        {
            if (_pauseGate.IsSet)
            {
                _pauseGate.Reset();
                _pauseButton.Content = "Resume";
                _status.Text = "Download paused.";
            }
            else
            {
                _pauseGate.Set();
                _pauseButton.Content = "Pause";
                _status.Text = "Download resumed.";
            }
        }

        private async Task CancelDownloadAsync()
        {
            _downloadCancellation?.Cancel();
            await Task.CompletedTask;
        }

        private async Task RefreshAsync()
        {
            try
            {
                _status.Text = "Refreshing deployments...";
                await LoadItemsAsync();
                _status.Text = "Deployments refreshed.";
            }
            catch (Exception ex)
            {
                _status.Text = ex.Message;
            }
        }

        private static string FormatBytes(long value)
        {
            string[] units = { "B", "KB", "MB", "GB", "TB" };
            var size = (double)value;
            var unit = 0;
            while (size >= 1024 && unit < units.Length - 1)
            {
                size /= 1024;
                unit++;
            }
            return $"{size:0.##} {units[unit]}";
        }
    }
}
