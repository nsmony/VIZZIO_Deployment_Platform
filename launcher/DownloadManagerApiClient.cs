using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Launcher
{
    public sealed class DownloadManagerApiClient
    {
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
        private readonly HttpClient _httpClient = new();
        private string _token = "";

        public string ApiBaseUrl { get; set; } = Environment.GetEnvironmentVariable("VIZZIO_API_BASE") ?? "http://localhost:4000/api";
        public string Token => _token;

        public void SetToken(string token)
        {
            _token = token;
            ApplyBearerToken();
        }

        public void ClearToken()
        {
            _token = "";
            ApplyBearerToken();
        }

        public Uri BuildFileUri(string fileId, string downloadToken)
        {
            var root = ApiBaseUrl.TrimEnd('/');
            return new Uri($"{root}/download-manager/files/{Uri.EscapeDataString(fileId)}?token={Uri.EscapeDataString(downloadToken)}");
        }

        public async Task<LoginResponse> LoginAsync(string username, string password, CancellationToken cancellationToken)
        {
            var response = await _httpClient.PostAsJsonAsync($"{ApiBaseUrl.TrimEnd('/')}/auth/login", new { username, password }, cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);
            var login = await response.Content.ReadFromJsonAsync<LoginResponse>(JsonOptions, cancellationToken);
            SetToken(login?.Token ?? "");
            return login ?? new LoginResponse();
        }

        public async Task<DownloadItemsResponse> GetDownloadItemsAsync(CancellationToken cancellationToken)
        {
            ApplyBearerToken();
            var response = await _httpClient.GetAsync($"{ApiBaseUrl.TrimEnd('/')}/download-manager/items", cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);
            return await response.Content.ReadFromJsonAsync<DownloadItemsResponse>(JsonOptions, cancellationToken) ?? new DownloadItemsResponse();
        }

        public async Task<DownloadSessionResponse> CreateSessionAsync(DownloadItem item, CancellationToken cancellationToken)
        {
            ApplyBearerToken();
            var response = await _httpClient.PostAsJsonAsync(
                $"{ApiBaseUrl.TrimEnd('/')}/download-manager/sessions",
                new { fileId = item.FileId, versionId = item.VersionId },
                cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);
            return await response.Content.ReadFromJsonAsync<DownloadSessionResponse>(JsonOptions, cancellationToken) ?? new DownloadSessionResponse();
        }

        public async Task UpdateSessionAsync(string sessionId, string status, long downloadedSize, long totalSize, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(sessionId)) return;
            ApplyBearerToken();
            var response = await _httpClient.PatchAsJsonAsync(
                $"{ApiBaseUrl.TrimEnd('/')}/download-manager/sessions/{Uri.EscapeDataString(sessionId)}",
                new { status, downloadedSize, totalSize },
                cancellationToken);
            await EnsureSuccessAsync(response, cancellationToken);
        }

        private void ApplyBearerToken()
        {
            _httpClient.DefaultRequestHeaders.Authorization = string.IsNullOrWhiteSpace(_token)
                ? null
                : new AuthenticationHeaderValue("Bearer", _token);
        }

        private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
        {
            if (response.IsSuccessStatusCode) return;
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            var message = ExtractErrorMessage(body) ?? response.ReasonPhrase ?? "Request failed";
            var retryAfter = response.Headers.RetryAfter?.Delta;
            throw new LauncherApiException(response.StatusCode, message, retryAfter);
        }

        private static string? ExtractErrorMessage(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return null;
            try
            {
                using var document = JsonDocument.Parse(body);
                if (document.RootElement.TryGetProperty("error", out var error))
                {
                    if (error.ValueKind == JsonValueKind.String) return error.GetString();
                    if (error.ValueKind == JsonValueKind.Object && error.TryGetProperty("message", out var message))
                    {
                        return message.GetString();
                    }
                }
            }
            catch
            {
                // Fall back to returning the raw response body.
            }
            return body;
        }
    }

    public sealed class LauncherApiException : InvalidOperationException
    {
        public LauncherApiException(HttpStatusCode statusCode, string message, TimeSpan? retryAfter)
            : base(message)
        {
            StatusCode = statusCode;
            RetryAfter = retryAfter;
        }

        public HttpStatusCode StatusCode { get; }
        public TimeSpan? RetryAfter { get; }
    }
}
