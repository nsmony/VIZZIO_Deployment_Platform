using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using ShapePath = System.Windows.Shapes.Path;

namespace Launcher
{
    // Main WPF launcher window. It owns UI state, queue orchestration, persisted
    // resume state, and package installation after ChunkedDownloadManager
    // finishes writing the cache file.
    public sealed class DownloadManagerWindow : Window
    {
        private readonly DownloadManagerApiClient _api = new();
        private readonly ChunkedDownloadManager _downloader = new();
        private readonly ObservableCollection<DownloadItem> _items = new();
        private readonly Dictionary<string, Button> _navButtons = new();
        private readonly Queue<DownloadItem> _downloadQueue = new();
        private readonly HashSet<string> _queuedDownloadKeys = new(StringComparer.OrdinalIgnoreCase);
        private readonly ManualResetEventSlim _pauseGate = new(true);
        private readonly DispatcherTimer _pollTimer = new() { Interval = TimeSpan.FromMinutes(5) };
        private LauncherUserSettings _settings = LoadLauncherSettings();
        private LauncherBrandingSettings _branding = LoadBrandingSettings();
        private CancellationTokenSource? _downloadCancellation;
        private CancellationTokenSource? _activeTransferCancellation;
        private bool _isDownloadActive;
        private bool _pauseRequested;
        private bool _resumeAfterPauseStop;
        private DownloadItem? _activeDownloadItem;
        private DownloadItem? _failedDownloadItem;
        private string _failedDownloadTargetPath = "";
        private string _activeDownloadTargetPath = "";
        private bool _deletePartialOnCancel;
        private bool _autoResumeAttempted;
        private DownloadItem? _selectedItem;
        private string _activeDownloadSessionId = "";
        private long _activeDownloadTotalSize;
        private long _lastDownloadedSize;
        private Grid _contentHost = null!;
        private TextBlock _pageTitle = null!;
        private TextBlock _pageSubtitle = null!;
        private WrapPanel _cardsPanel = null!;
        private ProgressBar _progress = null!;
        private TextBlock _status = null!;
        private TextBlock _metrics = null!;
        private TextBox _installPath = null!;
        private TextBox _searchBox = null!;
        private Button _startButton = null!;
        private Button _pauseButton = null!;
        private string _activeFilter = "All";
        private string _activeSection = "Library";

        private static readonly Brush PageBackground = BrushFrom("#F8FAFC");
        private static readonly Brush Surface = Brushes.White;
        private static readonly Brush Primary = BrushFrom("#2563EB");
        private static readonly Brush PrimarySoft = BrushFrom("#DBEAFE");
        private static readonly Brush Text = BrushFrom("#111827");
        private static readonly Brush Muted = BrushFrom("#64748B");
        private static readonly Brush UiBorder = BrushFrom("#E2E8F0");
        private static readonly Brush SuccessSoft = BrushFrom("#E2F7EB");
        private static readonly Brush Success = BrushFrom("#047857");
        private static readonly Brush BetaSoft = BrushFrom("#E0F2FE");
        private static readonly Brush Beta = BrushFrom("#0369A1");
        private static readonly Brush WarningSoft = BrushFrom("#FEF3C7");
        private static readonly Brush Warning = BrushFrom("#92400E");

        public DownloadManagerWindow()
        {
            Title = "VIZZIO Launcher";
            Width = 1120;
            Height = 760;
            MinWidth = 940;
            MinHeight = 640;
            Background = PageBackground;
            Closing += (_, _) =>
            {
                PersistDownloadState();
                _pollTimer.Stop();
            };
            _pollTimer.Tick += async (_, _) => await RefreshAsync(showStatus: false);
            ShowLogin();
            Loaded += async (_, _) => await TryRestoreSessionAsync();
        }

        private void ShowLogin()
        {
            var username = CreateTextBox();
            var password = new PasswordBox { Margin = new Thickness(0, 6, 0, 16), Height = 42, Padding = new Thickness(12, 8, 12, 8), BorderBrush = UiBorder };
            var server = CreateTextBox(_api.ApiBaseUrl);
            var message = new TextBlock { Margin = new Thickness(0, 14, 0, 0), TextWrapping = TextWrapping.Wrap, Foreground = Muted };
            var button = CreatePrimaryButton("Sign in", 130);

            var panel = new StackPanel { Width = 430, VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Center };
            panel.Children.Add(CreateLogoMark(_branding, 58));
            panel.Children.Add(new TextBlock { Text = "Package library", FontSize = 34, FontWeight = FontWeights.SemiBold, Foreground = Text, Margin = new Thickness(0, 22, 0, 8) });
            panel.Children.Add(new TextBlock { Text = "Sign in to browse installed and available VIZZIO deployments.", FontSize = 15, Foreground = Muted, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 28) });
            panel.Children.Add(CreateLabel("Server URL"));
            panel.Children.Add(server);
            panel.Children.Add(CreateLabel("Username"));
            panel.Children.Add(username);
            panel.Children.Add(CreateLabel("Password"));
            panel.Children.Add(password);
            panel.Children.Add(button);
            panel.Children.Add(message);

            Content = new Border { Background = PageBackground, Child = panel };

            button.Click += async (_, _) =>
            {
                try
                {
                    button.IsEnabled = false;
                    message.Text = "Signing in...";
                    _api.ApiBaseUrl = server.Text.Trim();
                    var login = await _api.LoginAsync(username.Text.Trim(), password.Password, CancellationToken.None);
                    try
                    {
                        PersistSession(login);
                    }
                    catch (Exception saveError)
                    {
                        _api.ClearToken();
                        message.Foreground = Warning;
                        message.Text = $"Session could not be saved: {FriendlyError(saveError)}";
                        return;
                    }
                    await LoadItemsAsync();
                    ShowManager();
                }
                catch (LauncherApiException ex) when (ex.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    var delay = ex.RetryAfter ?? TimeSpan.FromSeconds(60);
                    message.Foreground = Warning;
                    message.Text = $"Too many sign-in attempts. Try again in {Math.Ceiling(delay.TotalSeconds)} seconds.";
                    await Task.Delay(delay);
                }
                catch (Exception ex)
                {
                    message.Foreground = Warning;
                    message.Text = FriendlyError(ex);
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
            _progress = new ProgressBar { Minimum = 0, Maximum = 100, Height = 22, Margin = new Thickness(0, 8, 0, 0) };
            _status = new TextBlock { Text = "Select a package to download or open.", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 12, 0, 0), Foreground = Muted };
            _metrics = new TextBlock { Text = "Speed: -   ETA: -", Margin = new Thickness(0, 8, 0, 0), Foreground = Muted };
            _installPath = CreateTextBox(GetActiveInstallRoot());
            _searchBox = CreateTextBox();
            _searchBox.Margin = new Thickness(0);
            _searchBox.MinWidth = 280;
            _searchBox.BorderThickness = new Thickness(0);
            _searchBox.TextChanged += (_, _) => RenderCards();
            _startButton = CreatePrimaryButton("Download", 120);
            _pauseButton = CreateSecondaryButton("Pause", 90);
            _pauseButton.IsEnabled = false;
            var cancelButton = CreateSecondaryButton("Cancel", 90);
            var refreshButton = CreateSecondaryButton("Refresh", 95);

            var shell = new Grid { Background = PageBackground };
            shell.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(260) });
            shell.ColumnDefinitions.Add(new ColumnDefinition());

            var sidebar = CreatePortalSidebar();
            Grid.SetColumn(sidebar, 0);
            shell.Children.Add(sidebar);

            var page = new DockPanel { Margin = new Thickness(28) };
            page.LastChildFill = true;
            Grid.SetColumn(page, 1);
            var header = CreateHeader(refreshButton);
            DockPanel.SetDock(header, Dock.Top);
            page.Children.Add(header);

            _contentHost = new Grid();
            page.Children.Add(_contentHost);
            shell.Children.Add(page);
            Content = shell;

            _startButton.Click += async (_, _) => await StartDownloadAsync();
            _pauseButton.Click += async (_, _) => await TogglePauseAsync();
            cancelButton.Click += async (_, _) => await CancelDownloadAsync();
            refreshButton.Click += async (_, _) => await RefreshAsync();
            SelectSection("Library");
            _pollTimer.Start();
            _ = ResumePendingDownloadsAsync();
        }

        private async Task StartDownloadAsync()
        {
            var item = _selectedItem ?? _failedDownloadItem;
            if (item is null)
            {
                _status.Text = "Choose a package first.";
                return;
            }

            await StartDownloadAsync(item, deletePartialsOnCancel: true);
        }

        private async Task StartDownloadAsync(DownloadItem item, bool deletePartialsOnCancel, bool startPaused = false)
        {
            if (_isDownloadActive)
            {
                // Steam-style behavior: only one package installs at a time, but
                // additional clicks become visible queued downloads.
                QueueDownload(item);
                SelectSection("Download");
                return;
            }

            if (!TryApplyInstallRootFromText())
            {
                return;
            }

            if (!item.Available)
            {
                _status.Text = "This package does not have a readable file on the server.";
                return;
            }

            var installFolder = GetInstallFolder(item);
            var fileName = string.IsNullOrWhiteSpace(item.FileName) ? $"{item.DeploymentName}-{item.VersionNumber}.zip" : item.FileName;
            var targetPath = Path.Combine(GetPackageCacheFolder(), SanitizePathPart(item.DeploymentName), SanitizePathPart(item.VersionNumber), fileName);
            if (IsInstalled(item))
            {
                _status.Text = "This version is already installed.";
                RenderCards();
                return;
            }

            if (string.IsNullOrWhiteSpace(item.Checksum))
            {
                _status.Text = "This package cannot be installed because the server did not provide a checksum.";
                return;
            }

            var ownsDownload = false;
            var keepPausedDownload = false;
            try
            {
                _isDownloadActive = true;
                _pauseRequested = startPaused;
                _resumeAfterPauseStop = false;
                _activeDownloadItem = item;
                _failedDownloadItem = null;
                _failedDownloadTargetPath = "";
                ownsDownload = true;
                PersistDownloadState();
                RenderCards();
                RefreshDownloadPageIfVisible();
                EnsureDiskSpaceForInstall(targetPath, (item.Size ?? 0) * 2);
                _startButton.IsEnabled = false;
                _pauseButton.IsEnabled = true;
                if (startPaused)
                {
                    _pauseGate.Reset();
                    _pauseButton.Content = "Resume";
                }
                else
                {
                    _pauseGate.Set();
                    _pauseButton.Content = "Pause";
                }
                _deletePartialOnCancel = false;
                _activeDownloadTargetPath = targetPath;
                _activeDownloadSessionId = "";
                _activeDownloadTotalSize = item.Size ?? 0;
                _lastDownloadedSize = GetSavedDownloadedBytes(targetPath);
                _downloadCancellation = new CancellationTokenSource();
                _status.Text = startPaused ? "Restored paused download." : "Creating download session...";
                if (startPaused)
                {
                    keepPausedDownload = true;
                    LogSavedDownloadBytes(_activeDownloadTargetPath);
                    _status.Text = "Download paused. Resume to continue from saved bytes.";
                    return;
                }

                // Session creation returns a short-lived file token. The token
                // may be refreshed during long Unreal-sized downloads.
                var session = await _api.CreateSessionAsync(item, _downloadCancellation.Token);
                fileName = string.IsNullOrWhiteSpace(session.File.Name) ? fileName : session.File.Name;
                targetPath = Path.Combine(GetPackageCacheFolder(), SanitizePathPart(item.DeploymentName), SanitizePathPart(item.VersionNumber), fileName);
                EnsureDiskSpaceForInstall(targetPath, session.File.Size * 2);
                _activeDownloadTargetPath = targetPath;
                _activeDownloadSessionId = session.Session.Id;
                _activeDownloadTotalSize = session.File.Size;
                _lastDownloadedSize = GetSavedDownloadedBytes(targetPath);
                PersistDownloadState();
                var downloadToken = session.Token;
                var tokenIssuedAt = DateTimeOffset.UtcNow;
                var lastSessionProgressUpdate = DateTimeOffset.MinValue;
                var sessionProgressUpdateRunning = false;

                var progress = new Progress<DownloadProgress>(value =>
                {
                    if (_pauseRequested || !_pauseGate.IsSet)
                    {
                        return;
                    }

                    _progress.Value = value.Percent;
                    _lastDownloadedSize = value.DownloadedBytes;
                    _activeDownloadTotalSize = value.TotalBytes;
                    _metrics.Text = $"Speed: {FormatBytes((long)value.BytesPerSecond)}/s   ETA: {value.Eta:mm\\:ss}   {FormatBytes(value.DownloadedBytes)} / {FormatBytes(value.TotalBytes)}";
                    if (_pauseGate.IsSet && IsDiskSpaceBelowRemaining(_activeDownloadTargetPath, value.TotalBytes - value.DownloadedBytes, out var shortfall))
                    {
                        PauseActiveDownload($"Download paused because disk space is low. Shortfall: {FormatDiskSpace(shortfall)}.", "Low disk space");
                        return;
                    }
                    PersistDownloadState();
                    if (value.TotalBytes > 0 && value.DownloadedBytes >= value.TotalBytes)
                    {
                        _pauseGate.Set();
                        _pauseButton.IsEnabled = false;
                        _pauseButton.Content = "Pause";
                    }

                    var now = DateTimeOffset.UtcNow;
                    if (!sessionProgressUpdateRunning &&
                        (now - lastSessionProgressUpdate >= TimeSpan.FromSeconds(2) || value.DownloadedBytes >= value.TotalBytes))
                    {
                        lastSessionProgressUpdate = now;
                        sessionProgressUpdateRunning = true;
                        _ = UpdateSessionProgressInBackgroundAsync(
                            session.Session.Id,
                            value.DownloadedBytes,
                            value.TotalBytes,
                            () => sessionProgressUpdateRunning = false);
                    }
                });

                _status.Text = "Downloading...";
                var attempt = 0;
                while (true)
                {
                    try
                    {
                        attempt++;
                        _activeTransferCancellation?.Dispose();
                        _activeTransferCancellation = CancellationTokenSource.CreateLinkedTokenSource(_downloadCancellation.Token);
                        var transferToken = _activeTransferCancellation.Token;
                        await _downloader.DownloadAsync(async () =>
                        {
                            // Refresh the download token before range requests
                            // start failing with authorization errors.
                            if (DateTimeOffset.UtcNow - tokenIssuedAt >= TimeSpan.FromMinutes(55) || IsTokenExpiring(downloadToken, TimeSpan.FromSeconds(60)))
                            {
                                var refreshed = await _api.CreateSessionAsync(item, transferToken);
                                downloadToken = refreshed.Token;
                                tokenIssuedAt = DateTimeOffset.UtcNow;
                            }

                            return _api.BuildFileUri(item.FileId, downloadToken);
                        }, targetPath, session.File.Size, item.Checksum, progress, _pauseGate, transferToken, CreateDownloadOptions());
                        break;
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (InvalidDataException) when (attempt < 3)
                    {
                        DeleteDownloadArtifacts(targetPath);
                        _status.Text = $"Package verification failed. Retrying ({attempt + 1}/3)...";
                    }
                    catch (Exception ex) when (attempt < 3)
                    {
                        _status.Text = $"Connection problem: {FriendlyDownloadError(ex)} Retrying ({attempt + 1}/3)...";
                        await Task.Delay(TimeSpan.FromSeconds(2), _downloadCancellation.Token);
                    }
                    catch (InvalidDataException)
                    {
                        throw new InvalidDataException("Package verification failed 3 times. Please contact support.");
                    }
                    catch (Exception ex)
                    {
                        // Keep partial files and pause the workflow after all
                        // automatic retries fail. Pressing Resume continues from
                        // the saved .part files.
                        PauseActiveDownload(
                            $"Download paused after repeated connection problems: {FriendlyDownloadError(ex)} Check the network, then resume.",
                            "Repeated connection problems");
                        throw new OperationCanceledException(_downloadCancellation?.Token ?? CancellationToken.None);
                    }
                }
                RemoveDownloadState(item);
                _status.Text = "Extracting package...";
                _pauseButton.IsEnabled = false;
                var installedPath = await Task.Run(() => InstallPackage(targetPath, installFolder), _downloadCancellation.Token);
                await TryUpdateSessionAsync(session.Session.Id, "completed", session.File.Size, session.File.Size, CancellationToken.None);
                _progress.Value = 100;
                _status.Text = HasLaunchBatchScript(installFolder)
                    ? $"Installed to {installedPath}"
                    : $"Installed to {installedPath}. The package did not contain a launch batch script.";
                LauncherLog.Info($"Download completed: {targetPath}");
                TryOpenFolder(installFolder, out _);
                RenderCards();
            }
            catch (OperationCanceledException)
            {
                if (_pauseRequested && !_deletePartialOnCancel)
                {
                    keepPausedDownload = true;
                    _pauseGate.Reset();
                    _pauseButton.IsEnabled = true;
                    _pauseButton.Content = "Resume";
                    _startButton.IsEnabled = false;
                    PersistDownloadState();
                    LogSavedDownloadBytes(_activeDownloadTargetPath);
                    _status.Text = "Download paused. Resume to continue from saved bytes.";
                }
                else if (_deletePartialOnCancel && deletePartialsOnCancel)
                {
                    DeleteDownloadArtifacts(_activeDownloadTargetPath);
                    RemoveDownloadState(item);
                    _status.Text = "Download canceled. Partial package files were removed.";
                }
                else
                {
                    PersistDownloadState();
                    _status.Text = "Download interrupted. Start again to resume from existing part files.";
                }
            }
            catch (IOException ex) when (ex.Message.StartsWith("Not enough free disk space.", StringComparison.OrdinalIgnoreCase))
            {
                _status.Text = FriendlyError(ex);
                var result = MessageBox.Show(
                    $"{FriendlyError(ex)}\n\nChoose a different install root now?",
                    "Insufficient disk space",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                {
                    SelectSection("Settings");
                }
            }
            catch (Exception ex)
            {
                _selectedItem = item;
                _failedDownloadItem = item;
                _failedDownloadTargetPath = string.IsNullOrWhiteSpace(_activeDownloadTargetPath) ? targetPath : _activeDownloadTargetPath;
                RemoveDownloadState(item);
                _status.Text = FriendlyError(ex);
            }
            finally
            {
                if (ownsDownload)
                {
                    _activeTransferCancellation?.Dispose();
                    _activeTransferCancellation = null;
                    _downloadCancellation?.Dispose();
                    _downloadCancellation = null;

                    if (keepPausedDownload)
                    {
                        var resumeAfterPauseStop = _resumeAfterPauseStop;
                        _resumeAfterPauseStop = false;
                        _deletePartialOnCancel = false;
                        _pauseGate.Reset();
                        _isDownloadActive = true;
                        _activeDownloadItem = item;
                        _activeDownloadTargetPath = targetPath;
                        PersistDownloadState();
                        RenderCards();
                        RefreshDownloadPageIfVisible();

                        if (resumeAfterPauseStop)
                        {
                            LauncherLog.Info($"Resume started after streams stopped: {GetDownloadLabel(item)}");
                            _pauseRequested = false;
                            _pauseGate.Set();
                            _isDownloadActive = false;
                            _activeDownloadItem = null;
                            _activeDownloadTargetPath = "";
                            _activeDownloadSessionId = "";
                            _activeDownloadTotalSize = 0;
                            _lastDownloadedSize = 0;
                            await StartDownloadAsync(item, deletePartialsOnCancel: false);
                        }
                    }
                    else
                    {
                        _startButton.IsEnabled = true;
                        _pauseButton.IsEnabled = false;
                        _pauseButton.Content = "Pause";
                        _pauseRequested = false;
                        _resumeAfterPauseStop = false;
                        _deletePartialOnCancel = false;
                        _activeDownloadTargetPath = "";
                        _activeDownloadSessionId = "";
                        _activeDownloadTotalSize = 0;
                        _lastDownloadedSize = 0;
                        _activeDownloadItem = null;
                        _isDownloadActive = false;
                        PersistDownloadState();
                        RenderCards();
                        RefreshDownloadPageIfVisible();
                        await StartNextQueuedDownloadAsync();
                    }
                }
            }
        }

        private async Task TryUpdateSessionAsync(string sessionId, string status, long downloadedSize, long totalSize, CancellationToken cancellationToken)
        {
            try
            {
                await _api.UpdateSessionAsync(sessionId, status, downloadedSize, totalSize, cancellationToken);
            }
            catch (LauncherApiException ex) when (ex.StatusCode == HttpStatusCode.TooManyRequests)
            {
                // Progress telemetry should not fail a completed package download.
            }
            catch
            {
                // The next progress tick or refresh can repair stale session state.
            }
        }

        private async Task UpdateSessionProgressInBackgroundAsync(string sessionId, long downloadedSize, long totalSize, Action markComplete)
        {
            try
            {
                await TryUpdateSessionAsync(sessionId, "downloading", downloadedSize, totalSize, CancellationToken.None);
            }
            catch
            {
                // Progress telemetry should never surface as an unobserved launcher exception.
            }
            finally
            {
                if (!Dispatcher.HasShutdownStarted && !Dispatcher.HasShutdownFinished)
                {
                    try
                    {
                        await Dispatcher.InvokeAsync(markComplete);
                    }
                    catch
                    {
                        // The window may be closing while a telemetry update is unwinding.
                    }
                }
            }
        }

        private async Task TogglePauseAsync()
        {
            if (_activeDownloadItem is null)
            {
                return;
            }

            if (_pauseGate.IsSet && !_pauseRequested)
            {
                LauncherLog.Info($"Pause clicked: {GetDownloadLabel(_activeDownloadItem)}");
                PauseActiveDownload("Download paused.", "Pause clicked");
                return;
            }

            var item = _activeDownloadItem;
            if (_activeTransferCancellation is not null)
            {
                _resumeAfterPauseStop = true;
                _status.Text = "Stopping active streams before resume...";
                LauncherLog.Info($"Resume requested while streams are still stopping: {GetDownloadLabel(item)}");
                return;
            }

            LauncherLog.Info($"Resume started: {GetDownloadLabel(item)}");
            _pauseRequested = false;
            _pauseGate.Set();
            _pauseButton.Content = "Pause";
            _pauseButton.IsEnabled = true;
            _status.Text = "Resuming download...";
            PersistDownloadState();

            if (_activeTransferCancellation is null)
            {
                _isDownloadActive = false;
                _activeDownloadItem = null;
                _activeDownloadTargetPath = "";
                await StartDownloadAsync(item, deletePartialsOnCancel: false);
            }
        }

        private void PauseActiveDownload(string statusText, string reason)
        {
            if (_activeDownloadItem is null)
            {
                _status.Text = "No active download to pause.";
                return;
            }

            _pauseRequested = true;
            _deletePartialOnCancel = false;
            _pauseGate.Reset();
            _pauseButton.IsEnabled = true;
            _pauseButton.Content = "Resume";
            _startButton.IsEnabled = false;
            _status.Text = statusText;
            PersistDownloadState();
            LogSavedDownloadBytes(_activeDownloadTargetPath);
            ReportActiveSessionStatusInBackground("paused");
            LauncherLog.Info($"Cancelling active download streams: {reason}");
            _downloader.CancelActiveRequests();
            _activeTransferCancellation?.Cancel();
            _downloadCancellation?.Cancel();
        }

        private void LogSavedDownloadBytes(string targetPath)
        {
            var saved = GetSavedDownloadedBytes(targetPath);
            LauncherLog.Info($"Current downloaded bytes saved: {saved} bytes for {targetPath}");
        }

        private static long GetSavedDownloadedBytes(string targetPath)
        {
            var directory = Path.GetDirectoryName(targetPath);
            var fileName = Path.GetFileName(targetPath);
            if (string.IsNullOrWhiteSpace(directory) || string.IsNullOrWhiteSpace(fileName) || !Directory.Exists(directory))
            {
                return 0;
            }

            return Directory.EnumerateFiles(directory, $"{fileName}.part*")
                .Sum(path => new FileInfo(path).Length);
        }

        private async Task CancelDownloadAsync()
        {
            if (_activeDownloadItem is null)
            {
                _status.Text = "No active download to cancel.";
                await Task.CompletedTask;
                return;
            }

            // Cancel always opens the pause gate first so a paused worker can
            // observe cancellation instead of waiting forever.
            LauncherLog.Info($"Cancel clicked: {GetDownloadLabel(_activeDownloadItem)}");
            _deletePartialOnCancel = true;
            _pauseRequested = false;
            _resumeAfterPauseStop = false;
            _pauseGate.Set();
            _pauseButton.IsEnabled = false;
            _pauseButton.Content = "Pause";
            _startButton.IsEnabled = false;
            _status.Text = "Canceling download...";
            PersistDownloadState();
            ReportActiveSessionStatusInBackground("canceled");
            _downloader.CancelActiveRequests();
            _activeTransferCancellation?.Cancel();
            _downloadCancellation?.Cancel();
            if (_activeTransferCancellation is null && _activeDownloadItem is not null)
            {
                DeleteDownloadArtifacts(_activeDownloadTargetPath);
                RemoveDownloadState(_activeDownloadItem);
                _pauseRequested = false;
                _activeDownloadItem = null;
                _activeDownloadTargetPath = "";
                _activeDownloadSessionId = "";
                _activeDownloadTotalSize = 0;
                _lastDownloadedSize = 0;
                _isDownloadActive = false;
                _pauseButton.IsEnabled = false;
                _pauseButton.Content = "Pause";
                _startButton.IsEnabled = true;
                _status.Text = "Download canceled. Partial package files were removed.";
                RenderCards();
                RefreshDownloadPageIfVisible();
            }
            await Task.CompletedTask;
        }

        private void ReportActiveSessionStatusInBackground(string status)
        {
            var sessionId = _activeDownloadSessionId;
            if (string.IsNullOrWhiteSpace(sessionId))
            {
                return;
            }

            var downloadedSize = Math.Max(_lastDownloadedSize, GetSavedDownloadedBytes(_activeDownloadTargetPath));
            var totalSize = _activeDownloadTotalSize;
            _ = Task.Run(async () =>
            {
                try
                {
                    await TryUpdateSessionAsync(sessionId, status, downloadedSize, totalSize, CancellationToken.None);
                    LauncherLog.Info($"Backend download session marked {status}: {sessionId}");
                }
                catch (Exception ex)
                {
                    LauncherLog.Info($"Failed to mark backend download session {status}: {FriendlyError(ex)}");
                }
            });
        }

        private void ClearFailedDownload()
        {
            if (!string.IsNullOrWhiteSpace(_failedDownloadTargetPath))
            {
                DeleteDownloadArtifacts(_failedDownloadTargetPath);
            }

            if (_failedDownloadItem is not null)
            {
                RemoveDownloadState(_failedDownloadItem);
            }

            _failedDownloadItem = null;
            _failedDownloadTargetPath = "";
            _progress.Value = 0;
            _metrics.Text = "Speed: -   ETA: -";
            _status.Text = "Failed download cleared.";
            RenderCards();
            RefreshDownloadPageIfVisible();
        }

        private async Task RefreshAsync(bool showStatus = true)
        {
            try
            {
                if (showStatus) _status.Text = "Refreshing deployments...";
                await LoadItemsAsync();
                if (showStatus) _status.Text = "Deployments refreshed.";
                if (_activeSection == "Library" || _activeSection == "Installed")
                {
                    RenderCards();
                }
            }
            catch (Exception ex)
            {
                if (showStatus) _status.Text = FriendlyError(ex);
            }
        }

        private async Task ResumePendingDownloadsAsync()
        {
            if (_autoResumeAttempted) return;
            _autoResumeAttempted = true;

            await Task.Delay(400);
            var savedState = LoadDownloadState();
            // Restore queued cards before resuming the active item so the user
            // sees the same queue order after relaunch.
            foreach (var queued in savedState.Downloads
                .Where(entry => string.Equals(entry.Status, "queued", StringComparison.OrdinalIgnoreCase))
                .OrderBy(entry => entry.QueuedAt))
            {
                var queuedItem = FindDownloadItem(queued);
                if (queuedItem is not null && !IsInstalled(queuedItem) && queuedItem.Available)
                {
                    QueueDownload(queuedItem, showStatus: false);
                }
            }

            var activeState = savedState.Downloads
                .Where(entry => string.Equals(entry.Status, "downloading", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(entry.Status, "paused", StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(entry => entry.UpdatedAt)
                .FirstOrDefault();
            var pending = activeState is null ? null : FindDownloadItem(activeState);
            // If state JSON is missing but .part files exist, still offer a
            // resume path because the chunks are the source of downloaded bytes.
            pending ??= _items.FirstOrDefault(HasPartialDownload);
            if (pending is null) return;

            _selectedItem = pending;
            SelectSection("Download");
            var restorePaused = string.Equals(activeState?.Status, "paused", StringComparison.OrdinalIgnoreCase);
            _status.Text = restorePaused
                ? $"Restored paused download: {pending.DeploymentName} {pending.VersionNumber}."
                : $"Resuming {pending.DeploymentName} {pending.VersionNumber}...";
            await StartDownloadAsync(pending, deletePartialsOnCancel: false, startPaused: restorePaused);
        }

        private DockPanel CreateHeader(Button refreshButton)
        {
            var header = new DockPanel { Margin = new Thickness(0, 0, 0, 24) };
            var text = new StackPanel();
            text.Children.Add(new TextBlock { Text = "VIZZIO Launcher", Foreground = Muted, FontSize = 12, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 0, 8) });
            _pageTitle = new TextBlock { Text = "Package library", Foreground = Text, FontSize = 34, FontWeight = FontWeights.SemiBold };
            _pageSubtitle = new TextBlock { Text = "Browse installed and available packages for your VIZZIO deployment.", Foreground = Muted, FontSize = 15, Margin = new Thickness(0, 8, 0, 0) };
            text.Children.Add(_pageTitle);
            text.Children.Add(_pageSubtitle);

            var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Bottom };
            actions.Children.Add(refreshButton);
            DockPanel.SetDock(actions, Dock.Right);
            header.Children.Add(actions);
            header.Children.Add(text);

            return header;
        }

        private Border CreatePortalSidebar()
        {
            var panel = new DockPanel { Margin = new Thickness(18, 24, 18, 18) };

            var brand = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 34) };
            brand.Children.Add(CreateLogoMark(_branding, 42));
            var brandText = new StackPanel { Margin = new Thickness(12, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
            brandText.Children.Add(new TextBlock { Text = "VIZZIO", Foreground = Text, FontSize = 20, FontWeight = FontWeights.Bold });
            brandText.Children.Add(new TextBlock { Text = "Deployment Portal", Foreground = Muted, FontSize = 12 });
            brand.Children.Add(brandText);
            DockPanel.SetDock(brand, Dock.Top);
            panel.Children.Add(brand);

            var footer = new StackPanel { Margin = new Thickness(0, 18, 0, 0) };
            footer.Children.Add(new Border
            {
                Background = PageBackground,
                BorderBrush = UiBorder,
                BorderThickness = new Thickness(1),
                Padding = new Thickness(10),
                Child = new TextBlock
                {
                    Text = string.IsNullOrWhiteSpace(_settings.Username) ? "Signed in" : $"Signed in as {_settings.Username}",
                    Foreground = Muted,
                    FontSize = 12,
                    TextWrapping = TextWrapping.Wrap,
                },
            });
            var signOut = CreateSecondaryButton("Sign out", 200);
            signOut.Margin = new Thickness(0, 10, 0, 0);
            signOut.Click += (_, _) => SignOut();
            footer.Children.Add(signOut);
            DockPanel.SetDock(footer, Dock.Bottom);
            panel.Children.Add(footer);

            var nav = new StackPanel();
            nav.Children.Add(CreateNavSection("Library"));
            nav.Children.Add(CreateNavButton("packages", "All Packages", "Library"));
            nav.Children.Add(CreateNavButton("installed", "Installed", "Installed"));
            nav.Children.Add(CreateNavButton("download", "Download", "Download"));
            nav.Children.Add(CreateNavSection("Account"));
            nav.Children.Add(CreateNavButton("settings", "Settings", "Settings"));
            panel.Children.Add(nav);

            return new Border { Background = Surface, BorderBrush = UiBorder, BorderThickness = new Thickness(0, 0, 1, 0), Child = panel };
        }

        private static TextBlock CreateNavSection(string text)
        {
            return new TextBlock { Text = text.ToUpperInvariant(), Foreground = Muted, FontSize = 12, FontWeight = FontWeights.Bold, Margin = new Thickness(6, 18, 0, 8) };
        }

        private Button CreateNavButton(string icon, string label, string section)
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal };
            row.Children.Add(new Border
            {
                Width = 28,
                Height = 28,
                Background = PageBackground,
                Child = CreateNavIcon(icon),
            });
            row.Children.Add(new TextBlock { Text = label, Foreground = Text, FontSize = 14, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 0, 0) });

            var button = new Button
            {
                Content = row,
                HorizontalContentAlignment = HorizontalAlignment.Left,
                Background = Surface,
                BorderBrush = Brushes.Transparent,
                Padding = new Thickness(10),
                Margin = new Thickness(0, 0, 0, 8),
            };
            button.Click += (_, _) => SelectSection(section);
            _navButtons[section] = button;
            return button;
        }

        private static UIElement CreateNavIcon(string icon)
        {
            var canvas = new Canvas { Width = 24, Height = 24 };
            foreach (var geometry in GetNavIconGeometry(icon))
            {
                canvas.Children.Add(new ShapePath
                {
                    Data = Geometry.Parse(geometry),
                    Stroke = Muted,
                    StrokeThickness = 2,
                    StrokeStartLineCap = PenLineCap.Round,
                    StrokeEndLineCap = PenLineCap.Round,
                    StrokeLineJoin = PenLineJoin.Round,
                    Fill = Brushes.Transparent,
                });
            }

            return new Viewbox
            {
                Width = 17,
                Height = 17,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                Child = canvas,
            };
        }

        private static IEnumerable<string> GetNavIconGeometry(string icon)
        {
            return icon switch
            {
                "installed" => new[]
                {
                    "M21 8V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H16",
                    "M9 11L12 14L22 4",
                },
                "download" => new[]
                {
                    "M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15",
                    "M7 10L12 15L17 10",
                    "M12 15V3",
                },
                "settings" => new[]
                {
                    "M12 15.5A3.5 3.5 0 1 0 12 8.5A3.5 3.5 0 0 0 12 15.5",
                    "M19.4 15A1.65 1.65 0 0 0 19.7 16.8L19.8 16.9A2 2 0 1 1 16.9 19.8L16.8 19.7A1.65 1.65 0 0 0 15 19.4A1.65 1.65 0 0 0 14 20.9V21A2 2 0 1 1 10 21V20.9A1.65 1.65 0 0 0 9 19.4A1.65 1.65 0 0 0 7.2 19.7L7.1 19.8A2 2 0 1 1 4.2 16.9L4.3 16.8A1.65 1.65 0 0 0 4.6 15A1.65 1.65 0 0 0 3.1 14H3A2 2 0 1 1 3 10H3.1A1.65 1.65 0 0 0 4.6 9A1.65 1.65 0 0 0 4.3 7.2L4.2 7.1A2 2 0 1 1 7.1 4.2L7.2 4.3A1.65 1.65 0 0 0 9 4.6A1.65 1.65 0 0 0 10 3.1V3A2 2 0 1 1 14 3V3.1A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.8 4.3L16.9 4.2A2 2 0 1 1 19.8 7.1L19.7 7.2A1.65 1.65 0 0 0 19.4 9A1.65 1.65 0 0 0 20.9 10H21A2 2 0 1 1 21 14H20.9A1.65 1.65 0 0 0 19.4 15",
                },
                _ => new[]
                {
                    "M21 8L12 3L3 8L12 13L21 8",
                    "M3 8V16L12 21L21 16V8",
                    "M12 13V21",
                },
            };
        }

        private void SelectSection(string section)
        {
            _activeSection = section;
            _activeFilter = section == "Installed" ? "Installed" : "All";
            UpdateNavState();

            if (_pageTitle is not null)
            {
                _pageTitle.Text = section switch
                {
                    "Installed" => "Installed packages",
                    "Download" => "Active download",
                    "Settings" => "Launcher settings",
                    _ => "Package library",
                };
                _pageSubtitle.Text = section switch
                {
                    "Installed" => "Open installed package folders and verify local versions.",
                    "Download" => "Manage the selected package download.",
                    "Settings" => "Configure install location and server options.",
                    _ => "Browse installed and available packages for your VIZZIO deployment.",
                };
            }

            RenderPortalPage();
        }

        private void UpdateNavState()
        {
            foreach (var entry in _navButtons)
            {
                var active = entry.Key == _activeSection;
                entry.Value.Background = active ? PrimarySoft : Surface;
                entry.Value.BorderBrush = active ? PrimarySoft : Brushes.Transparent;
                entry.Value.FontWeight = active ? FontWeights.Bold : FontWeights.Normal;
            }
        }

        private void RenderPortalPage()
        {
            if (_contentHost is null) return;
            _contentHost.Children.Clear();

            if (_activeSection == "Download")
            {
                _contentHost.Children.Add(CreateDownloadPage());
                return;
            }

            if (_activeSection == "Settings")
            {
                _contentHost.Children.Add(CreateSettingsPage());
                return;
            }

            _contentHost.Children.Add(CreateLibraryPage());
            RenderCards();
        }

        private UIElement CreateLibraryPage()
        {
            var root = new Grid();
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition());

            var toolbar = CreateToolbar();
            Grid.SetRow(toolbar, 0);
            root.Children.Add(toolbar);

            _cardsPanel = new WrapPanel
            {
                Orientation = Orientation.Horizontal,
                Margin = new Thickness(0, 6, 0, 0),
            };

            var scroller = new ScrollViewer
            {
                Content = _cardsPanel,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            };
            Grid.SetRow(scroller, 1);
            root.Children.Add(scroller);

            return root;
        }

        private UIElement CreateDownloadPage()
        {
            var panel = new StackPanel { Width = GetPortalContentWidth(), HorizontalAlignment = HorizontalAlignment.Stretch };
            panel.Children.Add(CreateDownloadPanel());
            panel.Children.Add(CreateQueuedDownloadsPanel());
            return new ScrollViewer
            {
                Content = panel,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            };
        }

        private UIElement CreateSettingsPage()
        {
            DetachFromParent(_installPath);
            var panel = new StackPanel { Width = GetPortalContentWidth(), HorizontalAlignment = HorizontalAlignment.Stretch };
            var installPanel = new StackPanel();
            var installRootRow = new Grid();
            installRootRow.ColumnDefinitions.Add(new ColumnDefinition());
            installRootRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            Grid.SetColumn(_installPath, 0);
            installRootRow.Children.Add(_installPath);
            var browseInstallRoot = CreateSecondaryButton("Browse...", 95);
            browseInstallRoot.Margin = new Thickness(10, 6, 0, 16);
            browseInstallRoot.Click += (_, _) => BrowseInstallRoot();
            Grid.SetColumn(browseInstallRoot, 1);
            installRootRow.Children.Add(browseInstallRoot);
            installPanel.Children.Add(installRootRow);
            var saveInstallRoot = CreatePrimaryButton("Save install root", 150);
            saveInstallRoot.Margin = new Thickness(0, 10, 0, 0);
            saveInstallRoot.Click += (_, _) =>
            {
                if (TryApplyInstallRootFromText())
                {
                    _status.Text = "Install root saved.";
                }
            };
            installPanel.Children.Add(saveInstallRoot);
            panel.Children.Add(CreateSettingsCard("Install location", "Root install folder", installPanel));
            panel.Children.Add(CreateSettingsCard("Download performance", "Parallel streams and shared bandwidth cap", CreateDownloadSettingsPanel()));
            panel.Children.Add(CreateSettingsCard("Server", "API endpoint", new TextBlock { Text = _api.ApiBaseUrl, Foreground = Text, FontSize = 14, TextWrapping = TextWrapping.Wrap }));
            panel.Children.Add(CreateSettingsCard("Account", "Session", new TextBlock { Text = "Signed in to the launcher.", Foreground = Text, FontSize = 14 }));
            return new ScrollViewer
            {
                Content = panel,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            };
        }

        private UIElement CreateDownloadSettingsPanel()
        {
            var panel = new StackPanel();
            var streams = CreateTextBox(GetParallelStreamCount().ToString());
            streams.Margin = new Thickness(0, 6, 0, 10);
            panel.Children.Add(new TextBlock { Text = "Parallel streams (4-16)", Foreground = Muted, FontSize = 12, Margin = new Thickness(0, 0, 0, 2) });
            panel.Children.Add(streams);

            var bandwidth = CreateTextBox(_settings.BandwidthLimitMbps <= 0 ? "0" : _settings.BandwidthLimitMbps.ToString("0.##"));
            bandwidth.Margin = new Thickness(0, 6, 0, 10);
            panel.Children.Add(new TextBlock { Text = "Bandwidth cap in MB/s (0 = unlimited)", Foreground = Muted, FontSize = 12, Margin = new Thickness(0, 0, 0, 2) });
            panel.Children.Add(bandwidth);

            var save = CreatePrimaryButton("Save download settings", 190);
            save.Margin = new Thickness(0, 10, 0, 0);
            save.Click += (_, _) =>
            {
                if (!int.TryParse(streams.Text.Trim(), out var streamCount))
                {
                    _status.Text = "Parallel streams must be a number between 4 and 16.";
                    return;
                }

                if (!double.TryParse(bandwidth.Text.Trim(), out var bandwidthLimit))
                {
                    _status.Text = "Bandwidth cap must be a number in MB/s.";
                    return;
                }

                _settings.ParallelStreams = Math.Clamp(streamCount, 4, 16);
                _settings.BandwidthLimitMbps = Math.Max(0, bandwidthLimit);
                streams.Text = _settings.ParallelStreams.ToString();
                bandwidth.Text = _settings.BandwidthLimitMbps <= 0 ? "0" : _settings.BandwidthLimitMbps.ToString("0.##");
                SaveLauncherSettings(_settings);
                _status.Text = _settings.BandwidthLimitMbps <= 0
                    ? $"Download settings saved. Using {_settings.ParallelStreams} streams with no bandwidth cap."
                    : $"Download settings saved. Using {_settings.ParallelStreams} streams capped at {_settings.BandwidthLimitMbps:0.##} MB/s.";
            };
            panel.Children.Add(save);
            return panel;
        }

        private Border CreateSettingsCard(string title, string label, UIElement content)
        {
            DetachFromParent(content);
            var panel = new StackPanel();
            panel.Children.Add(new TextBlock { Text = title.ToUpperInvariant(), Foreground = Text, FontSize = 13, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 0, 12) });
            panel.Children.Add(new TextBlock { Text = label, Foreground = Muted, FontSize = 12, Margin = new Thickness(0, 0, 0, 6) });
            panel.Children.Add(content);
            return new Border
            {
                Background = Surface,
                BorderBrush = UiBorder,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(18),
                Margin = new Thickness(0, 0, 0, 16),
                Child = panel,
            };
        }

        private Border CreateDownloadPanel()
        {
            DetachFromParent(_installPath);
            DetachFromParent(_progress);
            DetachFromParent(_metrics);
            DetachFromParent(_status);
            DetachFromParent(_startButton);
            DetachFromParent(_pauseButton);

            var hasFailedDownload = _failedDownloadItem is not null && !_isDownloadActive;
            var displayItem = _activeDownloadItem ?? _failedDownloadItem;
            var sizeItem = displayItem ?? _selectedItem;
            _startButton.Content = hasFailedDownload ? "Retry" : "Download";
            _startButton.IsEnabled = !_isDownloadActive && (hasFailedDownload || _selectedItem is not null);
            _pauseButton.IsEnabled = _isDownloadActive;
            _pauseButton.Content = _pauseGate.IsSet ? "Pause" : "Resume";

            var cancelButton = CreateSecondaryButton(hasFailedDownload ? "Clear" : "Cancel", 90);
            cancelButton.IsEnabled = _isDownloadActive || hasFailedDownload;
            cancelButton.Click += async (_, _) =>
            {
                if (hasFailedDownload)
                {
                    ClearFailedDownload();
                }
                else
                {
                    await CancelDownloadAsync();
                }
            };

            var panel = new StackPanel();
            panel.Children.Add(new TextBlock { Text = displayItem is null ? "No active download" : $"{displayItem.DeploymentName} {displayItem.VersionNumber}", FontSize = 22, FontWeight = FontWeights.SemiBold, Foreground = Text, TextWrapping = TextWrapping.Wrap });
            panel.Children.Add(new TextBlock { Text = displayItem is null ? "Choose Download on a package to start immediately." : $"{displayItem.FileName}    {FormatBytes(displayItem.Size ?? 0)}", Foreground = Muted, Margin = new Thickness(0, 8, 0, 0), TextWrapping = TextWrapping.Wrap });
            panel.Children.Add(new TextBlock { Text = "Install root", Margin = new Thickness(0, 22, 0, 6), Foreground = Muted });
            panel.Children.Add(_installPath);
            panel.Children.Add(new TextBlock { Text = $"Space required: {FormatSpaceLabel(sizeItem?.Size ?? 0)}", Margin = new Thickness(0, 14, 0, 0), Foreground = Text });
            panel.Children.Add(new TextBlock { Text = $"Space available: {GetAvailableSpaceLabel(_installPath.Text)}", Margin = new Thickness(0, 4, 0, 0), Foreground = Text });
            panel.Children.Add(new TextBlock { Text = "Progress", Margin = new Thickness(0, 22, 0, 0), Foreground = Muted });
            panel.Children.Add(_progress);
            panel.Children.Add(_metrics);
            panel.Children.Add(_status);

            var buttons = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 18, 0, 0) };
            buttons.Children.Add(_startButton);
            buttons.Children.Add(_pauseButton);
            buttons.Children.Add(cancelButton);
            panel.Children.Add(buttons);

            return new Border
            {
                Background = Surface,
                BorderBrush = UiBorder,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(20),
                HorizontalAlignment = HorizontalAlignment.Stretch,
                Child = panel,
            };
        }

        private void RenderCards()
        {
            if (_cardsPanel is null) return;
            _cardsPanel.Children.Clear();

            var query = (_searchBox?.Text ?? "").Trim();
            var visible = _items.Where(item =>
            {
                var installed = IsInstalled(item);
                var channel = NormalizeChannel(item.ReleaseType);
                var matchesFilter = _activeFilter == "All"
                    || (_activeFilter == "Installed" ? installed : string.Equals(channel, _activeFilter, StringComparison.OrdinalIgnoreCase));
                var matchesSearch = string.IsNullOrWhiteSpace(query)
                    || item.DeploymentName.Contains(query, StringComparison.OrdinalIgnoreCase)
                    || item.VersionNumber.Contains(query, StringComparison.OrdinalIgnoreCase)
                    || (item.Description?.Contains(query, StringComparison.OrdinalIgnoreCase) ?? false);
                return matchesFilter && matchesSearch;
            }).ToList();

            if (visible.Count == 0)
            {
                _cardsPanel.Children.Add(CreateEmptyState());
                return;
            }

            if (_activeFilter == "All")
            {
                AddChannelGroup("Stable", visible);
                AddChannelGroup("Beta", visible);
                return;
            }

            foreach (var item in visible)
            {
                _cardsPanel.Children.Add(CreatePackageCard(item));
            }
        }

        private void AddChannelGroup(string channel, List<DownloadItem> items)
        {
            var group = items.Where(item => string.Equals(NormalizeChannel(item.ReleaseType), channel, StringComparison.OrdinalIgnoreCase)).ToList();
            if (group.Count == 0) return;

            _cardsPanel.Children.Add(new TextBlock
            {
                Text = channel,
                Width = GetPortalContentWidth(),
                Foreground = Text,
                FontSize = 20,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, _cardsPanel.Children.Count == 0 ? 0 : 14, 0, 12),
            });

            foreach (var item in group)
            {
                _cardsPanel.Children.Add(CreatePackageCard(item));
            }
        }

        private Border CreateToolbar()
        {
            var toolbar = new DockPanel { Margin = new Thickness(0, 0, 0, 18), LastChildFill = false };
            if (_searchBox.Parent is Panel previousParent)
            {
                previousParent.Children.Remove(_searchBox);
            }
            else if (_searchBox.Parent is Decorator previousDecorator)
            {
                previousDecorator.Child = null;
            }

            var searchShell = CreateSearchBoxShell();
            DockPanel.SetDock(searchShell, Dock.Left);
            toolbar.Children.Add(searchShell);

            var filters = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
            foreach (var filter in new[] { "All", "Stable", "Beta", "Installed" })
            {
                var button = filter == _activeFilter ? CreatePrimaryButton(filter, 92) : CreateSecondaryButton(filter, 92);
                button.Click += (_, _) =>
                {
                    _activeFilter = filter;
                    RenderPortalPage();
                };
                filters.Children.Add(button);
            }
            DockPanel.SetDock(filters, Dock.Right);
            toolbar.Children.Add(filters);

            return new Border
            {
                Child = toolbar,
                HorizontalAlignment = HorizontalAlignment.Stretch,
            };
        }

        private Border CreateSearchBoxShell()
        {
            DetachFromParent(_searchBox);
            var shell = new DockPanel
            {
                Width = 350,
                Height = 42,
                LastChildFill = true,
            };

            var icon = CreateSearchIcon();
            DockPanel.SetDock(icon, Dock.Left);
            shell.Children.Add(icon);
            shell.Children.Add(_searchBox);

            return new Border
            {
                Background = Surface,
                BorderBrush = UiBorder,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(12, 0, 8, 0),
                Child = shell,
            };
        }

        private static Canvas CreateSearchIcon()
        {
            var canvas = new Canvas { Width = 18, Height = 18, Margin = new Thickness(0, 0, 8, 0), VerticalAlignment = VerticalAlignment.Center };
            canvas.Children.Add(new System.Windows.Shapes.Ellipse
            {
                Width = 11,
                Height = 11,
                Stroke = Muted,
                StrokeThickness = 1.8,
            });
            var handle = new System.Windows.Shapes.Line
            {
                X1 = 11,
                Y1 = 11,
                X2 = 17,
                Y2 = 17,
                Stroke = Muted,
                StrokeThickness = 1.8,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
            };
            canvas.Children.Add(handle);
            return canvas;
        }

        private Border CreatePackageCard(DownloadItem item)
        {
            var installed = IsInstalled(item);
            var channel = NormalizeChannel(item.ReleaseType);
            var selected = ReferenceEquals(item, _selectedItem);

            var card = new StackPanel { MinHeight = 210 };
            var top = new DockPanel { Margin = new Thickness(0, 0, 0, 14) };
            top.Children.Add(CreatePill(channel, channel == "Beta" ? BetaSoft : PrimarySoft, channel == "Beta" ? Beta : Primary));
            if (installed)
            {
                var installedPill = CreatePill("Installed", SuccessSoft, Success);
                DockPanel.SetDock(installedPill, Dock.Right);
                top.Children.Add(installedPill);
            }
            card.Children.Add(top);

            card.Children.Add(new TextBlock { Text = item.DeploymentName, FontSize = 22, FontWeight = FontWeights.SemiBold, Foreground = Text, TextWrapping = TextWrapping.Wrap });
            card.Children.Add(new TextBlock
            {
                Text = string.IsNullOrWhiteSpace(item.Description) ? "Ready to install alongside other versions." : item.Description,
                Foreground = Muted,
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 22,
                Margin = new Thickness(0, 10, 0, 16),
                MaxHeight = 68,
            });

            var meta = new TextBlock { Text = $"{item.VersionNumber}    {FormatBytes(item.Size ?? 0)}", Foreground = Muted, FontSize = 14, Margin = new Thickness(0, 0, 0, 18) };
            card.Children.Add(meta);

            var actions = new StackPanel { Orientation = Orientation.Horizontal };
            var activeDownload = ReferenceEquals(item, _activeDownloadItem);
            var queuedDownload = _queuedDownloadKeys.Contains(GetDownloadKey(item));
            var buttonText = installed ? "Open folder" : activeDownload ? "Downloading" : queuedDownload ? "Queued" : "Download";
            var selectButton = CreatePrimaryButton(buttonText, 120);
            selectButton.IsEnabled = installed || !activeDownload;
            selectButton.Click += (_, _) =>
            {
                _selectedItem = item;
                if (installed) OpenInstallFolder(item);
                else if (_isDownloadActive)
                {
                    QueueDownload(item);
                    SelectSection("Download");
                }
                else
                {
                    SelectSection("Download");
                    _ = StartDownloadAsync(item, deletePartialsOnCancel: true);
                }
            };
            actions.Children.Add(selectButton);

            var detailsButton = CreateSecondaryButton(installed ? "Uninstall" : "Details", 92);
            detailsButton.Click += (_, _) =>
            {
                _selectedItem = item;
                if (installed)
                {
                    UninstallVersion(item);
                }
                else
                {
                    _status.Text = $"{item.DeploymentName} {item.VersionNumber} selected.";
                }
                RenderCards();
            };
            actions.Children.Add(detailsButton);
            card.Children.Add(actions);

            return new Border
            {
                Width = 330,
                Margin = new Thickness(0, 0, 20, 20),
                Padding = new Thickness(22),
                Background = Surface,
                BorderBrush = selected ? Primary : UiBorder,
                BorderThickness = new Thickness(selected ? 2 : 1),
                CornerRadius = new CornerRadius(8),
                Child = card,
            };
        }

        private Border CreateQueuedDownloadsPanel()
        {
            var panel = new StackPanel();
            panel.Children.Add(new TextBlock { Text = "Queue", FontSize = 20, FontWeight = FontWeights.SemiBold, Foreground = Text });

            var queued = _downloadQueue.ToList();
            if (queued.Count == 0)
            {
                panel.Children.Add(new TextBlock
                {
                    Text = "No queued downloads.",
                    Foreground = Muted,
                    Margin = new Thickness(0, 10, 0, 0),
                });
            }
            else
            {
                for (var i = 0; i < queued.Count; i++)
                {
                    panel.Children.Add(CreateQueuedDownloadCard(queued[i], i + 1));
                }
            }

            return new Border
            {
                Background = Surface,
                BorderBrush = UiBorder,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(20),
                Margin = new Thickness(0, 16, 0, 0),
                HorizontalAlignment = HorizontalAlignment.Stretch,
                Child = panel,
            };
        }

        private Border CreateQueuedDownloadCard(DownloadItem item, int position)
        {
            var row = new DockPanel { LastChildFill = true };
            var removeButton = CreateSecondaryButton("Remove", 90);
            removeButton.Click += (_, _) => RemoveQueuedDownload(item);
            DockPanel.SetDock(removeButton, Dock.Right);
            row.Children.Add(removeButton);

            var text = new StackPanel();
            text.Children.Add(new TextBlock { Text = $"{position}. {item.DeploymentName} {item.VersionNumber}", Foreground = Text, FontWeight = FontWeights.SemiBold, FontSize = 14, TextWrapping = TextWrapping.Wrap });
            text.Children.Add(new TextBlock { Text = $"{item.FileName}    {FormatBytes(item.Size ?? 0)}", Foreground = Muted, FontSize = 12, Margin = new Thickness(0, 4, 0, 0), TextWrapping = TextWrapping.Wrap });
            row.Children.Add(text);

            return new Border
            {
                Background = PageBackground,
                BorderBrush = UiBorder,
                BorderThickness = new Thickness(1),
                Padding = new Thickness(12),
                Margin = new Thickness(0, 12, 0, 0),
                Child = row,
            };
        }

        private void QueueDownload(DownloadItem item, bool showStatus = true)
        {
            if (ReferenceEquals(item, _activeDownloadItem))
            {
                if (showStatus) _status.Text = $"{item.DeploymentName} {item.VersionNumber} is already downloading.";
                return;
            }

            var key = GetDownloadKey(item);
            if (_queuedDownloadKeys.Contains(key))
            {
                if (showStatus) _status.Text = $"{item.DeploymentName} {item.VersionNumber} is already queued.";
                return;
            }

            _downloadQueue.Enqueue(item);
            _queuedDownloadKeys.Add(key);
            PersistDownloadState();
            if (showStatus) _status.Text = $"Queued {item.DeploymentName} {item.VersionNumber}. It will start after the active download.";
            RenderCards();
            RefreshDownloadPageIfVisible();
        }

        private void RemoveQueuedDownload(DownloadItem item)
        {
            var key = GetDownloadKey(item);
            if (!_queuedDownloadKeys.Contains(key)) return;

            var remaining = _downloadQueue.Where(entry => !string.Equals(GetDownloadKey(entry), key, StringComparison.OrdinalIgnoreCase)).ToList();
            _downloadQueue.Clear();
            _queuedDownloadKeys.Clear();
            foreach (var entry in remaining)
            {
                _downloadQueue.Enqueue(entry);
                _queuedDownloadKeys.Add(GetDownloadKey(entry));
            }

            PersistDownloadState();
            _status.Text = $"Removed {item.DeploymentName} {item.VersionNumber} from the queue.";
            RenderCards();
            RefreshDownloadPageIfVisible();
        }

        private async Task StartNextQueuedDownloadAsync()
        {
            while (_downloadQueue.Count > 0)
            {
                var next = _downloadQueue.Dequeue();
                _queuedDownloadKeys.Remove(GetDownloadKey(next));
                PersistDownloadState();
                RefreshDownloadPageIfVisible();
                if (IsInstalled(next) || !next.Available) continue;

                _selectedItem = next;
                SelectSection("Download");
                _status.Text = $"Starting queued download: {next.DeploymentName} {next.VersionNumber}...";
                await StartDownloadAsync(next, deletePartialsOnCancel: true);
                return;
            }
        }

        private void RefreshDownloadPageIfVisible()
        {
            if (_activeSection == "Download")
            {
                RenderPortalPage();
            }
        }

        private static string GetDownloadKey(DownloadItem item)
        {
            return string.IsNullOrWhiteSpace(item.VersionId) ? $"{item.DeploymentName}:{item.VersionNumber}:{item.FileId}" : item.VersionId;
        }

        private DownloadItem? FindDownloadItem(DownloadStateEntry entry)
        {
            return _items.FirstOrDefault(item =>
                (!string.IsNullOrWhiteSpace(entry.VersionId) && string.Equals(item.VersionId, entry.VersionId, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrWhiteSpace(entry.FileId) && string.Equals(item.FileId, entry.FileId, StringComparison.OrdinalIgnoreCase)) ||
                (string.Equals(item.DeploymentName, entry.DeploymentName, StringComparison.OrdinalIgnoreCase) &&
                 string.Equals(item.VersionNumber, entry.VersionNumber, StringComparison.OrdinalIgnoreCase)));
        }

        private static string GetDownloadLabel(DownloadItem? item)
        {
            return item is null ? "the active download" : $"{item.DeploymentName} {item.VersionNumber}";
        }

        private async Task TryRestoreSessionAsync()
        {
            if (Content is not Border) return;
            var token = WindowsCredentialStore.ReadToken();
            if (string.IsNullOrWhiteSpace(token)) return;
            if (IsExpiredJwt(token))
            {
                WindowsCredentialStore.ClearToken();
                return;
            }

            try
            {
                _api.SetToken(token);
                await LoadItemsAsync();
                ShowManager();
            }
            catch
            {
                _api.ClearToken();
            }
        }

        private Border CreateEmptyState()
        {
            var stack = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center };
            var noItems = _items.Count == 0 && string.IsNullOrWhiteSpace(_searchBox?.Text);
            stack.Children.Add(new TextBlock { Text = noItems ? "No deployments are currently available" : "No packages found", FontSize = 22, FontWeight = FontWeights.SemiBold, Foreground = Text, TextAlignment = TextAlignment.Center });
            stack.Children.Add(new TextBlock { Text = noItems ? "Your account does not currently have access to any released deployments." : "Try adjusting your filter or search term to locate available packages.", Foreground = Muted, TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 10, 0, 0) });
            return new Border
            {
                Width = GetPortalContentWidth(),
                Padding = new Thickness(28),
                Background = Surface,
                BorderBrush = UiBorder,
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Child = stack,
            };
        }

        private double GetPortalContentWidth()
        {
            var sidebarWidth = 260;
            var pageHorizontalMargin = 56;
            var scrollbarAllowance = 24;
            return Math.Max(680, ActualWidth - sidebarWidth - pageHorizontalMargin - scrollbarAllowance);
        }

        private string GetInstallFolder(DownloadItem item)
        {
            var root = GetActiveInstallRoot();
            return Path.Combine(root, SanitizePathPart(item.DeploymentName), SanitizePathPart(item.VersionNumber));
        }

        private bool IsInstalled(DownloadItem item)
        {
            var folder = GetInstallFolder(item);
            if (!Directory.Exists(folder)) return false;
            return Directory.EnumerateFileSystemEntries(folder).Any();
        }

        private static bool HasLaunchBatchScript(string folder)
        {
            return Directory.Exists(folder) &&
                Directory.EnumerateFiles(folder, "*.bat", SearchOption.TopDirectoryOnly).Any();
        }

        private bool HasPartialDownload(DownloadItem item)
        {
            var fileName = string.IsNullOrWhiteSpace(item.FileName) ? $"{item.DeploymentName}-{item.VersionNumber}.zip" : item.FileName;
            var targetPath = Path.Combine(GetPackageCacheFolder(), SanitizePathPart(item.DeploymentName), SanitizePathPart(item.VersionNumber), fileName);
            var directory = Path.GetDirectoryName(targetPath);
            if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory)) return false;
            return File.Exists($"{targetPath}.download")
                || Directory.EnumerateFiles(directory, $"{Path.GetFileName(targetPath)}.part*").Any();
        }

        private void OpenInstallFolder(DownloadItem item)
        {
            var folder = GetInstallFolder(item);
            if (!Directory.Exists(folder))
            {
                _status.Text = "The installation folder could not be found.";
                RenderCards();
                return;
            }

            if (!TryOpenFolder(folder, out var error))
            {
                _status.Text = error;
            }
        }

        private void UninstallVersion(DownloadItem item)
        {
            var folder = GetInstallFolder(item);
            if (!Directory.Exists(folder))
            {
                _status.Text = "The installation folder could not be found.";
                return;
            }

            var result = MessageBox.Show(
                $"Remove {item.DeploymentName} {item.VersionNumber} from this device?",
                "Uninstall version",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);
            if (result != MessageBoxResult.Yes) return;

            Directory.Delete(folder, recursive: true);
            _status.Text = $"{item.DeploymentName} {item.VersionNumber} was uninstalled.";
        }

        private static string SanitizePathPart(string value)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var cleaned = new string(value.Select(ch => invalid.Contains(ch) ? '_' : ch).ToArray()).Trim();
            return string.IsNullOrWhiteSpace(cleaned) ? "Package" : cleaned;
        }

        private string GetPackageCacheFolder()
        {
            return Path.Combine(GetActiveInstallRoot(), ".packages");
        }

        private static string InstallPackage(string packagePath, string installFolder)
        {
            var extension = Path.GetExtension(packagePath);
            if (string.Equals(extension, ".zip", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(extension, ".7z", StringComparison.OrdinalIgnoreCase) ||
                IsZipArchive(packagePath) ||
                IsSevenZipArchive(packagePath))
            {
                ExtractPackage(packagePath, installFolder);
                return installFolder;
            }

            if (Directory.Exists(installFolder)) Directory.Delete(installFolder, recursive: true);
            Directory.CreateDirectory(installFolder);
            var installedFilePath = Path.Combine(installFolder, Path.GetFileName(packagePath));
            File.Move(packagePath, installedFilePath, overwrite: true);
            return installedFilePath;
        }

        private static bool TryOpenFolder(string folder, out string error)
        {
            error = "";
            try
            {
                if (!Directory.Exists(folder))
                {
                    error = "The folder could not be found.";
                    return false;
                }

                Process.Start(new ProcessStartInfo("explorer.exe", $"\"{folder}\"") { UseShellExecute = true });
                return true;
            }
            catch
            {
                error = "Could not open the folder in File Explorer.";
                return false;
            }
        }

        private static void ExtractPackage(string archivePath, string installFolder)
        {
            var tempFolder = $"{installFolder}.extracting";
            if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, recursive: true);
            Directory.CreateDirectory(Path.GetDirectoryName(installFolder)!);

            try
            {
                var extension = Path.GetExtension(archivePath);
                if (string.Equals(extension, ".zip", StringComparison.OrdinalIgnoreCase) || IsZipArchive(archivePath))
                {
                    ZipFile.ExtractToDirectory(archivePath, tempFolder);
                }
                else if (string.Equals(extension, ".7z", StringComparison.OrdinalIgnoreCase) || IsSevenZipArchive(archivePath))
                {
                    Extract7ZipPackage(archivePath, tempFolder);
                }
                else
                {
                    throw new InvalidDataException($"This package type cannot be extracted by the launcher. The downloaded file has extension '{(string.IsNullOrWhiteSpace(extension) ? "(none)" : extension)}' and signature '{ReadFileSignature(archivePath)}'. Please provide a ZIP or 7z package.");
                }

                NormalizeExtractedRoot(tempFolder);

                if (Directory.Exists(installFolder)) Directory.Delete(installFolder, recursive: true);
                Directory.Move(tempFolder, installFolder);
                File.Delete(archivePath);
            }
            catch
            {
                if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, recursive: true);
                throw;
            }
        }

        private static bool IsZipArchive(string archivePath)
        {
            var signature = ReadFileHeader(archivePath, 4);
            return signature.Length >= 4
                && signature[0] == 0x50
                && signature[1] == 0x4B
                && (signature[2] == 0x03 || signature[2] == 0x05 || signature[2] == 0x07)
                && (signature[3] == 0x04 || signature[3] == 0x06 || signature[3] == 0x08);
        }

        private static bool IsSevenZipArchive(string archivePath)
        {
            var signature = ReadFileHeader(archivePath, 6);
            return signature.Length >= 6
                && signature[0] == 0x37
                && signature[1] == 0x7A
                && signature[2] == 0xBC
                && signature[3] == 0xAF
                && signature[4] == 0x27
                && signature[5] == 0x1C;
        }

        private static byte[] ReadFileHeader(string path, int byteCount)
        {
            var buffer = new byte[byteCount];
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var read = stream.Read(buffer, 0, buffer.Length);
            if (read == buffer.Length) return buffer;
            Array.Resize(ref buffer, read);
            return buffer;
        }

        private static string ReadFileSignature(string path)
        {
            var signature = ReadFileHeader(path, 8);
            return signature.Length == 0 ? "(empty)" : Convert.ToHexString(signature);
        }

        private static void Extract7ZipPackage(string archivePath, string tempFolder)
        {
            var executable = Find7ZipExecutable();
            if (string.IsNullOrWhiteSpace(executable))
            {
                throw new InvalidDataException("7z extraction requires 7z.exe or 7za.exe beside the launcher or available on PATH.");
            }

            Directory.CreateDirectory(tempFolder);
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = executable,
                Arguments = $"x -y -o\"{tempFolder}\" \"{archivePath}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
            });
            if (process is null)
            {
                throw new InvalidDataException("Could not start the 7z extractor.");
            }

            process.WaitForExit();
            if (process.ExitCode != 0)
            {
                var error = process.StandardError.ReadToEnd();
                throw new InvalidDataException(string.IsNullOrWhiteSpace(error) ? "7z extraction failed." : error.Trim());
            }
        }

        private static string? Find7ZipExecutable()
        {
            var baseDirectory = AppContext.BaseDirectory;
            foreach (var localName in new[] { "7z.exe", "7za.exe" })
            {
                var localPath = Path.Combine(baseDirectory, localName);
                if (File.Exists(localPath)) return localPath;
            }

            var pathValue = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (var directory in pathValue.Split(Path.PathSeparator).Where(Directory.Exists))
            {
                foreach (var name in new[] { "7z.exe", "7za.exe" })
                {
                    var candidate = Path.Combine(directory, name);
                    if (File.Exists(candidate)) return candidate;
                }
            }

            return null;
        }

        private static void NormalizeExtractedRoot(string tempFolder)
        {
            if (Directory.EnumerateFiles(tempFolder, "*.bat", SearchOption.TopDirectoryOnly).Any()) return;

            var files = Directory.EnumerateFiles(tempFolder).ToList();
            var directories = Directory.EnumerateDirectories(tempFolder).ToList();
            if (files.Count != 0 || directories.Count != 1) return;

            var nestedRoot = directories[0];
            var stagingRoot = $"{tempFolder}.root";
            if (Directory.Exists(stagingRoot)) Directory.Delete(stagingRoot, recursive: true);
            Directory.Move(nestedRoot, stagingRoot);
            Directory.Delete(tempFolder, recursive: true);
            Directory.Move(stagingRoot, tempFolder);
        }

        private static void EnsureDiskSpaceForInstall(string targetPath, long requiredBytes)
        {
            if (requiredBytes <= 0) return;
            var root = Path.GetPathRoot(Path.GetFullPath(targetPath)) ?? "";
            var drive = new DriveInfo(root);
            if (drive.AvailableFreeSpace < requiredBytes)
            {
                throw new IOException($"Not enough free disk space. Required: {FormatDiskSpace(requiredBytes)}, Available: {FormatDiskSpace(drive.AvailableFreeSpace)}.");
            }
        }

        private static bool IsDiskSpaceBelowRemaining(string targetPath, long remainingBytes, out long shortfall)
        {
            shortfall = 0;
            if (remainingBytes <= 0 || string.IsNullOrWhiteSpace(targetPath)) return false;

            try
            {
                var root = Path.GetPathRoot(Path.GetFullPath(targetPath)) ?? "";
                var drive = new DriveInfo(root);
                if (drive.AvailableFreeSpace >= remainingBytes) return false;
                shortfall = remainingBytes - drive.AvailableFreeSpace;
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string GetAvailableSpaceLabel(string installRoot)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(installRoot)) return "Unknown";
                var root = Path.GetPathRoot(Path.GetFullPath(installRoot));
                if (string.IsNullOrWhiteSpace(root)) return "Unknown";
                return FormatSpaceLabel(new DriveInfo(root).AvailableFreeSpace);
            }
            catch
            {
                return "Unknown";
            }
        }

        private void BrowseInstallRoot()
        {
            var dialog = new Microsoft.Win32.OpenFolderDialog
            {
                Title = "Select root install folder",
            };
            var currentPath = _installPath.Text.Trim();
            if (Directory.Exists(currentPath))
            {
                dialog.InitialDirectory = currentPath;
            }

            if (dialog.ShowDialog(this) == true)
            {
                _installPath.Text = dialog.FolderName;
            }
        }

        private static void DeleteDownloadArtifacts(string targetPath)
        {
            if (string.IsNullOrWhiteSpace(targetPath)) return;

            try
            {
                if (File.Exists(targetPath)) File.Delete(targetPath);
                var tempPath = $"{targetPath}.download";
                if (File.Exists(tempPath)) File.Delete(tempPath);

                var directory = Path.GetDirectoryName(targetPath);
                var fileName = Path.GetFileName(targetPath);
                if (string.IsNullOrWhiteSpace(directory) || string.IsNullOrWhiteSpace(fileName) || !Directory.Exists(directory)) return;

                foreach (var partPath in Directory.EnumerateFiles(directory, $"{fileName}.part*"))
                {
                    File.Delete(partPath);
                }
            }
            catch
            {
                // The next retry can overwrite or resume any file still locked by the OS.
            }
        }

        private static string NormalizeChannel(string value)
        {
            return string.Equals(value, "beta", StringComparison.OrdinalIgnoreCase) ? "Beta" : "Stable";
        }

        private string GetActiveInstallRoot()
        {
            return string.IsNullOrWhiteSpace(_settings.InstallRoot)
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Vizzio", "packages")
                : _settings.InstallRoot;
        }

        private DownloadOptions CreateDownloadOptions()
        {
            var bandwidthLimit = _settings.BandwidthLimitMbps <= 0
                ? 0
                : (long)(_settings.BandwidthLimitMbps * 1024 * 1024);
            return new DownloadOptions
            {
                ParallelStreams = GetParallelStreamCount(),
                BandwidthLimitBytesPerSecond = bandwidthLimit,
            };
        }

        private int GetParallelStreamCount()
        {
            return Math.Clamp(_settings.ParallelStreams <= 0 ? 4 : _settings.ParallelStreams, 4, 16);
        }

        private void PersistDownloadState()
        {
            try
            {
                var document = new DownloadStateDocument();
                if (_activeDownloadItem is not null)
                {
                    document.Downloads.Add(CreateDownloadStateEntry(
                        _activeDownloadItem,
                        _pauseGate.IsSet ? "downloading" : "paused",
                        _activeDownloadTargetPath));
                }

                foreach (var item in _downloadQueue)
                {
                    document.Downloads.Add(CreateDownloadStateEntry(item, "queued", ""));
                }

                SaveDownloadState(document);
            }
            catch
            {
                // Download state is best-effort; .part files still preserve byte offsets.
            }
        }

        private void RemoveDownloadState(DownloadItem item)
        {
            try
            {
                var key = GetDownloadKey(item);
                var document = LoadDownloadState();
                document.Downloads = document.Downloads
                    .Where(entry => !string.Equals(GetDownloadStateKey(entry), key, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                SaveDownloadState(document);
            }
            catch
            {
                // A stale state file only causes a harmless resume attempt later.
            }
        }

        private DownloadStateEntry CreateDownloadStateEntry(DownloadItem item, string status, string targetPath)
        {
            var resolvedTargetPath = string.IsNullOrWhiteSpace(targetPath) ? GetTargetPath(item) : targetPath;
            return new DownloadStateEntry
            {
                VersionId = item.VersionId,
                FileId = item.FileId,
                DeploymentName = item.DeploymentName,
                VersionNumber = item.VersionNumber,
                FileName = item.FileName,
                Status = status,
                InstallRoot = GetActiveInstallRoot(),
                TargetPath = resolvedTargetPath,
                Chunks = GetPartOffsets(resolvedTargetPath),
                QueuedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            };
        }

        private static List<DownloadChunkState> GetPartOffsets(string targetPath)
        {
            var directory = Path.GetDirectoryName(targetPath);
            var fileName = Path.GetFileName(targetPath);
            if (string.IsNullOrWhiteSpace(directory) || string.IsNullOrWhiteSpace(fileName) || !Directory.Exists(directory))
            {
                return new List<DownloadChunkState>();
            }

            return Directory.EnumerateFiles(directory, $"{fileName}.part*")
                .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                .Select(path => new DownloadChunkState
                {
                    PartName = Path.GetFileName(path),
                    BytesDownloaded = new FileInfo(path).Length,
                })
                .ToList();
        }

        private DownloadStateDocument LoadDownloadState()
        {
            try
            {
                var path = GetDownloadStatePath();
                if (!File.Exists(path)) return new DownloadStateDocument();
                return JsonSerializer.Deserialize<DownloadStateDocument>(File.ReadAllText(path)) ?? new DownloadStateDocument();
            }
            catch
            {
                return new DownloadStateDocument();
            }
        }

        private void SaveDownloadState(DownloadStateDocument document)
        {
            var path = GetDownloadStatePath();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            if (document.Downloads.Count == 0)
            {
                if (File.Exists(path)) File.Delete(path);
                return;
            }

            File.WriteAllText(path, JsonSerializer.Serialize(document, new JsonSerializerOptions { WriteIndented = true }));
        }

        private string GetDownloadStatePath()
        {
            return Path.Combine(GetActiveInstallRoot(), ".vizzio", "downloads", "download-state.json");
        }

        private string GetTargetPath(DownloadItem item)
        {
            var fileName = string.IsNullOrWhiteSpace(item.FileName) ? $"{item.DeploymentName}-{item.VersionNumber}.zip" : item.FileName;
            return Path.Combine(GetPackageCacheFolder(), SanitizePathPart(item.DeploymentName), SanitizePathPart(item.VersionNumber), fileName);
        }

        private static string GetDownloadStateKey(DownloadStateEntry entry)
        {
            return string.IsNullOrWhiteSpace(entry.VersionId)
                ? $"{entry.DeploymentName}:{entry.VersionNumber}:{entry.FileId}"
                : entry.VersionId;
        }

        private bool TryApplyInstallRootFromText()
        {
            var value = _installPath.Text.Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                _status.Text = "Choose an install root before downloading.";
                return false;
            }

            if (value.Length > 260 || value.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
            {
                _status.Text = "The path contains invalid characters or exceeds the 260-character limit.";
                return false;
            }

            var fullPath = Path.GetFullPath(value);
            if (!Directory.Exists(fullPath))
            {
                var result = MessageBox.Show(
                    "The selected install folder does not exist. Create it now?",
                    "Create install folder",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question);
                if (result != MessageBoxResult.Yes)
                {
                    _installPath.Text = GetActiveInstallRoot();
                    _status.Text = "Install root was not changed.";
                    return false;
                }

                Directory.CreateDirectory(fullPath);
            }

            if (!CanWriteToDirectory(fullPath))
            {
                _status.Text = "The selected path is not writable.";
                return false;
            }

            _settings.InstallRoot = fullPath;
            _installPath.Text = fullPath;
            SaveLauncherSettings(_settings);
            return true;
        }

        private void SignOut()
        {
            _pollTimer.Stop();
            _downloadCancellation?.Cancel();
            _api.ClearToken();
            WindowsCredentialStore.ClearToken();
            _settings.Username = "";
            SaveLauncherSettings(_settings);
            _items.Clear();
            _selectedItem = null;
            ShowLogin();
        }

        private static bool CanWriteToDirectory(string directory)
        {
            try
            {
                Directory.CreateDirectory(directory);
                var testPath = Path.Combine(directory, $".vizzio-write-test-{Guid.NewGuid():N}.tmp");
                File.WriteAllText(testPath, "");
                File.Delete(testPath);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static LauncherUserSettings LoadLauncherSettings()
        {
            try
            {
                var path = GetSettingsPath();
                if (!File.Exists(path)) return new LauncherUserSettings();
                return JsonSerializer.Deserialize<LauncherUserSettings>(File.ReadAllText(path)) ?? new LauncherUserSettings();
            }
            catch
            {
                return new LauncherUserSettings();
            }
        }

        private static LauncherBrandingSettings LoadBrandingSettings()
        {
            try
            {
                var path = Path.Combine(AppContext.BaseDirectory, "launcher-branding.json");
                if (!File.Exists(path)) return new LauncherBrandingSettings();
                return JsonSerializer.Deserialize<LauncherBrandingSettings>(File.ReadAllText(path)) ?? new LauncherBrandingSettings();
            }
            catch
            {
                return new LauncherBrandingSettings();
            }
        }

        private static void SaveLauncherSettings(LauncherUserSettings settings)
        {
            var path = GetSettingsPath();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }));
        }

        private static string GetSettingsPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "VIZZIO",
                "Launcher",
                "settings.json");
        }

        private void PersistSession(LoginResponse login)
        {
            WindowsCredentialStore.SaveToken(login.Token);
            _settings.Username = ExtractUsername(login) ?? _settings.Username;
            SaveLauncherSettings(_settings);
        }

        private static string? ExtractUsername(LoginResponse login)
        {
            if (login.User is null) return null;
            if (!login.User.TryGetValue("username", out var value)) return null;
            return value switch
            {
                string text => text,
                JsonElement element when element.ValueKind == JsonValueKind.String => element.GetString(),
                _ => value?.ToString(),
            };
        }

        private static bool IsExpiredJwt(string token)
        {
            try
            {
                var parts = token.Split('.');
                if (parts.Length < 2) return false;
                var payload = DecodeBase64Url(parts[1]);
                using var document = JsonDocument.Parse(payload);
                if (!document.RootElement.TryGetProperty("exp", out var expElement)) return false;
                var exp = expElement.GetInt64();
                return DateTimeOffset.FromUnixTimeSeconds(exp) <= DateTimeOffset.UtcNow;
            }
            catch
            {
                return false;
            }
        }

        private static bool IsTokenExpiring(string token, TimeSpan threshold)
        {
            try
            {
                var parts = token.Split('.');
                if (parts.Length < 2) return false;
                var payload = DecodeBase64Url(parts[1]);
                using var document = JsonDocument.Parse(payload);
                if (!document.RootElement.TryGetProperty("exp", out var expElement)) return false;
                var exp = DateTimeOffset.FromUnixTimeSeconds(expElement.GetInt64());
                return exp - DateTimeOffset.UtcNow <= threshold;
            }
            catch
            {
                return false;
            }
        }

        private static byte[] DecodeBase64Url(string value)
        {
            var padded = value.Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + ((4 - padded.Length % 4) % 4), '=');
            return Convert.FromBase64String(padded);
        }

        private static void DetachFromParent(UIElement element)
        {
            if (element is not FrameworkElement frameworkElement) return;

            if (frameworkElement.Parent is Panel panel)
            {
                panel.Children.Remove(element);
            }
            else if (frameworkElement.Parent is Decorator decorator)
            {
                decorator.Child = null;
            }
            else if (frameworkElement.Parent is ContentControl contentControl)
            {
                contentControl.Content = null;
            }
        }

        private static TextBlock CreateLabel(string text)
        {
            return new TextBlock { Text = text, Foreground = Muted, Margin = new Thickness(0, 0, 0, 6), FontWeight = FontWeights.SemiBold };
        }

        private static TextBox CreateTextBox(string text = "")
        {
            return new TextBox { Text = text, Margin = new Thickness(0, 6, 0, 16), Height = 42, Padding = new Thickness(12, 8, 12, 8), BorderBrush = UiBorder, Background = Surface, Foreground = Text };
        }

        private static Button CreatePrimaryButton(string text, double width)
        {
            return new Button { Content = text, Width = width, Height = 38, Margin = new Thickness(0, 0, 10, 0), Background = Primary, Foreground = Brushes.White, BorderBrush = Primary, FontWeight = FontWeights.Bold };
        }

        private static Button CreateSecondaryButton(string text, double width)
        {
            return new Button { Content = text, Width = width, Height = 38, Margin = new Thickness(0, 0, 10, 0), Background = Surface, Foreground = Text, BorderBrush = UiBorder, FontWeight = FontWeights.Bold };
        }

        private static Border CreatePill(string text, Brush background, Brush foreground)
        {
            return new Border
            {
                Background = background,
                Padding = new Thickness(12, 7, 12, 7),
                Child = new TextBlock { Text = text, Foreground = foreground, FontWeight = FontWeights.Bold, FontSize = 12 },
            };
        }

        private static Border CreateLogoMark(LauncherBrandingSettings branding, double size)
        {
            var logo = TryCreateLogoImage(branding, size);
            if (logo is not null)
            {
                return new Border
                {
                    Width = size,
                    Height = size,
                    Background = Brushes.Transparent,
                    Child = logo,
                };
            }

            return new Border
            {
                Width = size,
                Height = size,
                Background = PrimarySoft,
                Child = new TextBlock { Text = "V", Foreground = Primary, FontSize = Math.Max(18, size * 0.48), FontWeight = FontWeights.Bold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center },
            };
        }

        private static Image? TryCreateLogoImage(LauncherBrandingSettings branding, double size)
        {
            try
            {
                var path = ResolveLogoPath(branding.LogoPath);
                if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return null;

                var extension = Path.GetExtension(path).ToLowerInvariant();
                if (extension is not ".png" and not ".jpg" and not ".jpeg" and not ".ico") return null;
                if (new FileInfo(path).Length > 5 * 1024 * 1024) return null;

                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.UriSource = new Uri(path);
                bitmap.EndInit();
                bitmap.Freeze();

                return new Image { Source = bitmap, Width = size, Height = size, Stretch = Stretch.Uniform };
            }
            catch
            {
                return null;
            }
        }

        private static string? ResolveLogoPath(string? logoPath)
        {
            if (string.IsNullOrWhiteSpace(logoPath)) return null;
            return Path.IsPathRooted(logoPath)
                ? Path.GetFullPath(logoPath)
                : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, logoPath));
        }

        private static string FriendlyError(Exception ex)
        {
            if (ex is LauncherApiException apiException)
            {
                return apiException.StatusCode switch
                {
                    HttpStatusCode.Unauthorized => "The username or password is incorrect.",
                    HttpStatusCode.Forbidden => "Your account has been disabled or does not have access. Please contact your administrator.",
                    HttpStatusCode.TooManyRequests => "Too many attempts. Please wait before trying again.",
                    >= HttpStatusCode.InternalServerError => "The server is temporarily unavailable. Please try again later.",
                    _ => string.IsNullOrWhiteSpace(apiException.Message) ? "Something went wrong. Please try again." : apiException.Message,
                };
            }

            var message = ex.Message;
            if (message.Contains("401") || message.Contains("incorrect", StringComparison.OrdinalIgnoreCase))
            {
                return "The username or password is incorrect.";
            }
            if (message.Contains("403") || message.Contains("disabled", StringComparison.OrdinalIgnoreCase))
            {
                return "Your account cannot access this package. Please contact your administrator.";
            }
            if (message.Contains("No connection", StringComparison.OrdinalIgnoreCase) || message.Contains("actively refused", StringComparison.OrdinalIgnoreCase))
            {
                return "Could not connect to the server. Check the server URL and try again.";
            }
            return string.IsNullOrWhiteSpace(message) ? "Something went wrong. Please try again." : message;
        }

        private static string FriendlyDownloadError(Exception ex)
        {
            var message = ex.GetBaseException().Message;
            if (string.IsNullOrWhiteSpace(message))
            {
                return "the connection was interrupted.";
            }

            if (message.Contains("401") || message.Contains("expired", StringComparison.OrdinalIgnoreCase))
            {
                return "download authorization expired.";
            }

            if (message.Contains("403"))
            {
                return "your account no longer has access to this package.";
            }

            if (message.Contains("416"))
            {
                return "the saved partial file no longer matches the server file.";
            }

            if (message.Contains("Saved partial chunk", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("stuck chunk", StringComparison.OrdinalIgnoreCase))
            {
                return "one saved chunk was stuck, so the launcher is repairing that chunk.";
            }

            if (message.Contains("range", StringComparison.OrdinalIgnoreCase))
            {
                return "the server rejected a resume range request.";
            }

            if (message.Contains("ended early", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("response ended prematurely", StringComparison.OrdinalIgnoreCase))
            {
                return "the server closed a download stream early.";
            }

            if (message.Contains("actively refused", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("No connection", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("timed out", StringComparison.OrdinalIgnoreCase))
            {
                return "the server could not be reached reliably.";
            }

            return "one download stream failed before the chunk completed.";
        }

        private static string FormatBytes(long value)
        {
            if (value <= 0) return "-";
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

        private static string FormatSpaceLabel(long value)
        {
            string[] units = { "B", "KB", "MB", "GB", "TB" };
            var size = (double)Math.Max(0, value);
            var unit = 0;
            while (size >= 1024 && unit < units.Length - 1)
            {
                size /= 1024;
                unit++;
            }
            return $"{size:0.##} {units[unit]}";
        }

        private static string FormatDiskSpace(long value)
        {
            var size = Math.Max(0, value);
            if (size >= 1024L * 1024 * 1024)
            {
                return $"{size / 1024d / 1024d / 1024d:0.00} GB";
            }

            return $"{size / 1024d / 1024d:0.##} MB";
        }

        private static SolidColorBrush BrushFrom(string value)
        {
            return (SolidColorBrush)new BrushConverter().ConvertFromString(value)!;
        }

        private sealed class LauncherUserSettings
        {
            public string InstallRoot { get; set; } = "";
            public string Username { get; set; } = "";
            public int ParallelStreams { get; set; } = 4;
            public double BandwidthLimitMbps { get; set; }
        }

        private sealed class DownloadStateDocument
        {
            public List<DownloadStateEntry> Downloads { get; set; } = new();
        }

        private sealed class DownloadStateEntry
        {
            public string VersionId { get; set; } = "";
            public string FileId { get; set; } = "";
            public string DeploymentName { get; set; } = "";
            public string VersionNumber { get; set; } = "";
            public string FileName { get; set; } = "";
            public string Status { get; set; } = "";
            public string InstallRoot { get; set; } = "";
            public string TargetPath { get; set; } = "";
            public List<DownloadChunkState> Chunks { get; set; } = new();
            public DateTimeOffset QueuedAt { get; set; } = DateTimeOffset.UtcNow;
            public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
        }

        private sealed class DownloadChunkState
        {
            public string PartName { get; set; } = "";
            public long BytesDownloaded { get; set; }
        }

        private sealed class LauncherBrandingSettings
        {
            public string LogoPath { get; set; } = "";
        }
    }
}
