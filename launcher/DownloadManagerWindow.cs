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

namespace Launcher
{
    public sealed class DownloadManagerWindow : Window
    {
        private readonly DownloadManagerApiClient _api = new();
        private readonly ChunkedDownloadManager _downloader = new();
        private readonly ObservableCollection<DownloadItem> _items = new();
        private readonly Dictionary<string, Button> _navButtons = new();
        private readonly ManualResetEventSlim _pauseGate = new(true);
        private readonly DispatcherTimer _pollTimer = new() { Interval = TimeSpan.FromMinutes(5) };
        private LauncherUserSettings _settings = LoadLauncherSettings();
        private LauncherBrandingSettings _branding = LoadBrandingSettings();
        private CancellationTokenSource? _downloadCancellation;
        private string _activeDownloadTargetPath = "";
        private bool _deletePartialOnCancel;
        private bool _autoResumeAttempted;
        private DownloadItem? _selectedItem;
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
            Closing += (_, _) => _pollTimer.Stop();
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
            _pauseButton.Click += (_, _) => TogglePause();
            cancelButton.Click += async (_, _) => await CancelDownloadAsync();
            refreshButton.Click += async (_, _) => await RefreshAsync();
            SelectSection("Library");
            _pollTimer.Start();
            _ = ResumePendingDownloadsAsync();
        }

        private async Task StartDownloadAsync()
        {
            if (_selectedItem is not DownloadItem item)
            {
                _status.Text = "Choose a package first.";
                return;
            }

            await StartDownloadAsync(item, deletePartialsOnCancel: true);
        }

        private async Task StartDownloadAsync(DownloadItem item, bool deletePartialsOnCancel)
        {
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

            try
            {
                EnsureDiskSpaceForInstall(targetPath, (item.Size ?? 0) * 2);
                _startButton.IsEnabled = false;
                _pauseButton.IsEnabled = true;
                _pauseGate.Set();
                _deletePartialOnCancel = false;
                _activeDownloadTargetPath = targetPath;
                _downloadCancellation = new CancellationTokenSource();
                _status.Text = "Creating download session...";
                var session = await _api.CreateSessionAsync(item, _downloadCancellation.Token);
                fileName = string.IsNullOrWhiteSpace(session.File.Name) ? fileName : session.File.Name;
                targetPath = Path.Combine(GetPackageCacheFolder(), SanitizePathPart(item.DeploymentName), SanitizePathPart(item.VersionNumber), fileName);
                _activeDownloadTargetPath = targetPath;
                var downloadToken = session.Token;
                var tokenIssuedAt = DateTimeOffset.UtcNow;
                var lastSessionProgressUpdate = DateTimeOffset.MinValue;
                var sessionProgressUpdateRunning = false;

                var progress = new Progress<DownloadProgress>(value =>
                {
                    _progress.Value = value.Percent;
                    _metrics.Text = $"Speed: {FormatBytes((long)value.BytesPerSecond)}/s   ETA: {value.Eta:mm\\:ss}   {FormatBytes(value.DownloadedBytes)} / {FormatBytes(value.TotalBytes)}";
                    var now = DateTimeOffset.UtcNow;
                    if (sessionProgressUpdateRunning || now - lastSessionProgressUpdate < TimeSpan.FromSeconds(1)) return;

                    lastSessionProgressUpdate = now;
                    sessionProgressUpdateRunning = true;
                    _ = _api.UpdateSessionAsync(session.Session.Id, "downloading", value.DownloadedBytes, value.TotalBytes, CancellationToken.None)
                        .ContinueWith(_ => sessionProgressUpdateRunning = false, TaskScheduler.FromCurrentSynchronizationContext());
                });

                _status.Text = "Downloading...";
                var attempt = 0;
                while (true)
                {
                    try
                    {
                        attempt++;
                        await _downloader.DownloadAsync(async () =>
                        {
                            if (DateTimeOffset.UtcNow - tokenIssuedAt >= TimeSpan.FromMinutes(55))
                            {
                                var refreshed = await _api.CreateSessionAsync(item, _downloadCancellation.Token);
                                downloadToken = refreshed.Token;
                                tokenIssuedAt = DateTimeOffset.UtcNow;
                            }

                            return _api.BuildFileUri(item.FileId, downloadToken);
                        }, targetPath, session.File.Size, item.Checksum, progress, _pauseGate, _downloadCancellation.Token);
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
                    catch (Exception) when (attempt < 3)
                    {
                        _status.Text = $"Connection problem. Retrying ({attempt + 1}/3)...";
                        await Task.Delay(TimeSpan.FromSeconds(2), _downloadCancellation.Token);
                    }
                    catch (InvalidDataException)
                    {
                        throw new InvalidDataException("Package verification failed 3 times. Please contact support.");
                    }
                    catch
                    {
                        _pauseGate.Reset();
                        _pauseButton.Content = "Resume";
                        throw new IOException("The connection failed 3 times. Check your connection, then resume the download.");
                    }
                }
                _status.Text = "Extracting package...";
                InstallPackage(targetPath, installFolder);
                await _api.UpdateSessionAsync(session.Session.Id, "completed", session.File.Size, session.File.Size, CancellationToken.None);
                _progress.Value = 100;
                _status.Text = $"Installed to {installFolder}";
                RenderCards();
            }
            catch (OperationCanceledException)
            {
                if (_deletePartialOnCancel && deletePartialsOnCancel)
                {
                    DeleteDownloadArtifacts(_activeDownloadTargetPath);
                    _status.Text = "Download canceled. Partial package files were removed.";
                }
                else
                {
                    _status.Text = "Download interrupted. Start again to resume from existing part files.";
                }
            }
            catch (Exception ex)
            {
                _status.Text = FriendlyError(ex);
                MessageBox.Show(FriendlyError(ex), "Download failed", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            finally
            {
                _startButton.IsEnabled = true;
                _pauseButton.IsEnabled = false;
                _pauseButton.Content = "Pause";
                _deletePartialOnCancel = false;
                _activeDownloadTargetPath = "";
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
            _deletePartialOnCancel = true;
            _downloadCancellation?.Cancel();
            await Task.CompletedTask;
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
            var pending = _items.FirstOrDefault(HasPartialDownload);
            if (pending is null) return;

            _selectedItem = pending;
            SelectSection("Download");
            _status.Text = $"Resuming {pending.DeploymentName} {pending.VersionNumber}...";
            await StartDownloadAsync(pending, deletePartialsOnCancel: false);
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
            nav.Children.Add(CreateNavButton("PK", "All Packages", "Library"));
            nav.Children.Add(CreateNavButton("IN", "Installed", "Installed"));
            nav.Children.Add(CreateNavButton("DL", "Download", "Download"));
            nav.Children.Add(CreateNavSection("Account"));
            nav.Children.Add(CreateNavButton("ST", "Settings", "Settings"));
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
                Child = new TextBlock { Text = icon, Foreground = Muted, FontSize = 10, FontWeight = FontWeights.Bold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center },
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
            var panel = new Grid { Width = GetPortalContentWidth() };
            panel.Children.Add(CreateDownloadPanel());
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
            installPanel.Children.Add(_installPath);
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
            panel.Children.Add(CreateSettingsCard("Server", "API endpoint", new TextBlock { Text = _api.ApiBaseUrl, Foreground = Text, FontSize = 14, TextWrapping = TextWrapping.Wrap }));
            panel.Children.Add(CreateSettingsCard("Account", "Session", new TextBlock { Text = "Signed in to the launcher.", Foreground = Text, FontSize = 14 }));
            return new ScrollViewer
            {
                Content = panel,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            };
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

            var cancelButton = CreateSecondaryButton("Cancel", 90);
            cancelButton.Click += async (_, _) => await CancelDownloadAsync();

            var panel = new StackPanel();
            panel.Children.Add(new TextBlock { Text = "Download", FontSize = 22, FontWeight = FontWeights.SemiBold, Foreground = Text });
            panel.Children.Add(new TextBlock { Text = "Install root", Margin = new Thickness(0, 22, 0, 6), Foreground = Muted });
            panel.Children.Add(_installPath);
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

            foreach (var item in visible)
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
                Text = string.IsNullOrWhiteSpace(item.Description) ? "Ready for download and side-by-side installation." : item.Description,
                Foreground = Muted,
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 22,
                Margin = new Thickness(0, 10, 0, 16),
                MaxHeight = 68,
            });

            var meta = new TextBlock { Text = $"{item.VersionNumber}    {FormatBytes(item.Size ?? 0)}", Foreground = Muted, FontSize = 14, Margin = new Thickness(0, 0, 0, 18) };
            card.Children.Add(meta);

            var actions = new StackPanel { Orientation = Orientation.Horizontal };
            var selectButton = installed ? CreatePrimaryButton("Open folder", 120) : CreatePrimaryButton("Download", 120);
            selectButton.Click += (_, _) =>
            {
                _selectedItem = item;
                if (installed) OpenInstallFolder(item);
                else
                {
                    _status.Text = $"{item.DeploymentName} {item.VersionNumber} selected.";
                    SelectSection("Download");
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
            stack.Children.Add(new TextBlock { Text = "No packages found", FontSize = 22, FontWeight = FontWeights.SemiBold, Foreground = Text, TextAlignment = TextAlignment.Center });
            stack.Children.Add(new TextBlock { Text = "Try adjusting your filter or search term to locate available packages.", Foreground = Muted, TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 10, 0, 0) });
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
            return Directory.Exists(folder) && Directory.EnumerateFiles(folder, "*.bat", SearchOption.TopDirectoryOnly).Any();
        }

        private bool HasPartialDownload(DownloadItem item)
        {
            var fileName = string.IsNullOrWhiteSpace(item.FileName) ? $"{item.DeploymentName}-{item.VersionNumber}.zip" : item.FileName;
            var targetPath = Path.Combine(GetPackageCacheFolder(), SanitizePathPart(item.DeploymentName), SanitizePathPart(item.VersionNumber), fileName);
            var directory = Path.GetDirectoryName(targetPath);
            if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory)) return false;
            return Directory.EnumerateFiles(directory, $"{Path.GetFileName(targetPath)}.part*").Any();
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

            Process.Start(new ProcessStartInfo("explorer.exe", $"\"{folder}\"") { UseShellExecute = true });
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

        private static void InstallPackage(string packagePath, string installFolder)
        {
            var extension = Path.GetExtension(packagePath);
            if (string.Equals(extension, ".zip", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(extension, ".7z", StringComparison.OrdinalIgnoreCase))
            {
                ExtractPackage(packagePath, installFolder);
                return;
            }

            if (Directory.Exists(installFolder)) Directory.Delete(installFolder, recursive: true);
            Directory.CreateDirectory(installFolder);
            File.Move(packagePath, Path.Combine(installFolder, Path.GetFileName(packagePath)), overwrite: true);
        }

        private static void ExtractPackage(string archivePath, string installFolder)
        {
            var tempFolder = $"{installFolder}.extracting";
            if (Directory.Exists(tempFolder)) Directory.Delete(tempFolder, recursive: true);
            Directory.CreateDirectory(Path.GetDirectoryName(installFolder)!);

            try
            {
                var extension = Path.GetExtension(archivePath);
                if (string.Equals(extension, ".zip", StringComparison.OrdinalIgnoreCase))
                {
                    ZipFile.ExtractToDirectory(archivePath, tempFolder);
                }
                else if (string.Equals(extension, ".7z", StringComparison.OrdinalIgnoreCase))
                {
                    Extract7ZipPackage(archivePath, tempFolder);
                }
                else
                {
                    throw new InvalidDataException("This package type cannot be extracted by the launcher. Please provide a ZIP or 7z package.");
                }

                NormalizeExtractedRoot(tempFolder);
                if (!Directory.EnumerateFiles(tempFolder, "*.bat", SearchOption.TopDirectoryOnly).Any())
                {
                    throw new InvalidDataException("The package did not contain the expected launch batch script.");
                }

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
                throw new IOException($"Not enough free disk space. Required {FormatBytes(requiredBytes)}, available {FormatBytes(drive.AvailableFreeSpace)}.");
            }
        }

        private static void DeleteDownloadArtifacts(string targetPath)
        {
            if (string.IsNullOrWhiteSpace(targetPath)) return;

            try
            {
                if (File.Exists(targetPath)) File.Delete(targetPath);

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

        private static SolidColorBrush BrushFrom(string value)
        {
            return (SolidColorBrush)new BrushConverter().ConvertFromString(value)!;
        }

        private sealed class LauncherUserSettings
        {
            public string InstallRoot { get; set; } = "";
            public string Username { get; set; } = "";
        }

        private sealed class LauncherBrandingSettings
        {
            public string LogoPath { get; set; } = "";
        }
    }
}
