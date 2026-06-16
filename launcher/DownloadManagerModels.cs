using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Launcher
{
    public sealed class LoginResponse
    {
        [JsonPropertyName("token")]
        public string Token { get; set; } = "";

        [JsonPropertyName("role")]
        public string Role { get; set; } = "";

        [JsonPropertyName("user")]
        public Dictionary<string, object>? User { get; set; }
    }

    public sealed class DownloadItemsResponse
    {
        [JsonPropertyName("items")]
        public List<DownloadItem> Items { get; set; } = new();
    }

    public sealed class DownloadItem
    {
        [JsonPropertyName("deploymentName")]
        public string DeploymentName { get; set; } = "";

        [JsonPropertyName("versionNumber")]
        public string VersionNumber { get; set; } = "";

        [JsonPropertyName("releaseType")]
        public string ReleaseType { get; set; } = "";

        [JsonPropertyName("versionId")]
        public string VersionId { get; set; } = "";

        [JsonPropertyName("fileId")]
        public string FileId { get; set; } = "";

        [JsonPropertyName("fileName")]
        public string FileName { get; set; } = "";

        [JsonPropertyName("size")]
        public long? Size { get; set; }

        [JsonPropertyName("checksum")]
        public string? Checksum { get; set; }

        [JsonPropertyName("available")]
        public bool Available { get; set; }

        public override string ToString()
        {
            var status = Available ? "" : " (file missing)";
            return $"{DeploymentName} {VersionNumber} [{ReleaseType}]{status}";
        }
    }

    public sealed class DownloadSessionResponse
    {
        [JsonPropertyName("session")]
        public DownloadSessionDto Session { get; set; } = new();

        [JsonPropertyName("token")]
        public string Token { get; set; } = "";

        [JsonPropertyName("file")]
        public DownloadFileDto File { get; set; } = new();
    }

    public sealed class DownloadSessionDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";
    }

    public sealed class DownloadFileDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("size")]
        public long Size { get; set; }
    }
}
