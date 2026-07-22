using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Launcher
{
    // DTOs mirror the JSON contracts returned by the backend. Keep these simple
    // so API compatibility problems fail close to the network boundary.
    public sealed class LoginResponse
    {
        // The JWT is stored by the launcher and sent back on every API request.
        [JsonPropertyName("token")]
        public string Token { get; set; } = "";

        // Role is currently mostly informational in the launcher, but keeping it
        // here makes the login contract match the admin web app contract.
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
        // These display fields are flattened by the backend so the launcher does
        // not need to understand the full deployment/version database shape.
        [JsonPropertyName("deploymentName")]
        public string DeploymentName { get; set; } = "";

        [JsonPropertyName("versionNumber")]
        public string VersionNumber { get; set; } = "";

        [JsonPropertyName("releaseType")]
        public string ReleaseType { get; set; } = "";

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("deploymentDescription")]
        public string? DeploymentDescription { get; set; }

        [JsonPropertyName("versionDescription")]
        public string? VersionDescription { get; set; }

        [JsonPropertyName("versionId")]
        public string VersionId { get; set; } = "";

        [JsonPropertyName("fileId")]
        public string FileId { get; set; } = "";

        [JsonPropertyName("fileName")]
        public string FileName { get; set; } = "";

        [JsonPropertyName("size")]
        public long? Size { get; set; }

        [JsonPropertyName("installSize")]
        public long? InstallSize { get; set; }

        // SHA-256 from the registered package. The download manager verifies it
        // after writing the final file to disk.
        [JsonPropertyName("checksum")]
        public string? Checksum { get; set; }

        // False means the version exists in the catalog but the package file is
        // missing or unavailable on the server.
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
        // Sessions allow the backend to issue short-lived download URLs/tokens
        // without exposing the package storage path directly to the client.
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

        [JsonPropertyName("installSize")]
        public long? InstallSize { get; set; }
    }
}
