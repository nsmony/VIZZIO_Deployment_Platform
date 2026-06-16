using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

namespace Launcher
{
    public sealed class DownloadProgress
    {
        public long DownloadedBytes { get; init; }
        public long TotalBytes { get; init; }
        public double BytesPerSecond { get; init; }
        public TimeSpan Eta { get; init; }
        public double Percent => TotalBytes <= 0 ? 0 : Math.Min(100, DownloadedBytes * 100d / TotalBytes);
    }

    public sealed class ChunkedDownloadManager
    {
        private const int ChunkCount = 4;
        private readonly HttpClient _httpClient = new();

        public async Task<string> DownloadAsync(
            Uri source,
            string targetPath,
            long expectedSize,
            string? expectedSha256,
            IProgress<DownloadProgress> progress,
            ManualResetEventSlim pauseGate,
            CancellationToken cancellationToken)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
            EnsureDiskSpace(targetPath, expectedSize);

            var totalBytes = expectedSize > 0 ? expectedSize : await GetRemoteLengthAsync(source, cancellationToken);
            var chunks = CreateChunks(totalBytes, targetPath);
            var stopwatch = Stopwatch.StartNew();

            await Task.WhenAll(chunks.Select(chunk => DownloadChunkAsync(source, chunk, progress, pauseGate, stopwatch, totalBytes, cancellationToken)));
            MergeChunks(chunks, targetPath);

            if (!string.IsNullOrWhiteSpace(expectedSha256))
            {
                var actual = await ComputeSha256Async(targetPath, cancellationToken);
                if (!string.Equals(actual, expectedSha256, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidDataException("Downloaded file checksum did not match. Please re-download the package.");
                }
            }

            return targetPath;
        }

        private async Task<long> GetRemoteLengthAsync(Uri source, CancellationToken cancellationToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Head, source);
            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                using var rangeRequest = new HttpRequestMessage(HttpMethod.Get, source);
                rangeRequest.Headers.Range = new RangeHeaderValue(0, 0);
                using var rangeResponse = await _httpClient.SendAsync(rangeRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if (rangeResponse.Content.Headers.ContentRange?.Length is long rangeLength) return rangeLength;
                rangeResponse.EnsureSuccessStatusCode();
            }
            return response.Content.Headers.ContentLength ?? throw new InvalidOperationException("Server did not provide a file size.");
        }

        private static List<DownloadChunk> CreateChunks(long totalBytes, string targetPath)
        {
            var chunkSize = Math.Max(1, totalBytes / ChunkCount);
            var chunks = new List<DownloadChunk>();
            for (var i = 0; i < ChunkCount; i++)
            {
                var start = i * chunkSize;
                var end = i == ChunkCount - 1 ? totalBytes - 1 : Math.Min(totalBytes - 1, start + chunkSize - 1);
                chunks.Add(new DownloadChunk(start, end, $"{targetPath}.part{i}"));
            }
            return chunks;
        }

        private async Task DownloadChunkAsync(
            Uri source,
            DownloadChunk chunk,
            IProgress<DownloadProgress> progress,
            ManualResetEventSlim pauseGate,
            Stopwatch stopwatch,
            long totalBytes,
            CancellationToken cancellationToken)
        {
            var existing = File.Exists(chunk.PartPath) ? new FileInfo(chunk.PartPath).Length : 0;
            var start = chunk.Start + existing;
            if (start > chunk.End) return;

            using var request = new HttpRequestMessage(HttpMethod.Get, source);
            request.Headers.Range = new RangeHeaderValue(start, chunk.End);
            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            if (response.StatusCode != HttpStatusCode.PartialContent)
            {
                throw new InvalidOperationException("Server does not support HTTP range requests for this file.");
            }

            await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
            await using var output = new FileStream(chunk.PartPath, FileMode.Append, FileAccess.Write, FileShare.Read, 1024 * 128, true);
            var buffer = new byte[1024 * 128];
            while (true)
            {
                pauseGate.Wait(cancellationToken);
                var read = await input.ReadAsync(buffer, cancellationToken);
                if (read == 0) break;
                await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                ReportProgress(progress, totalBytes, stopwatch, chunk.PartPath);
            }
        }

        private static void ReportProgress(IProgress<DownloadProgress> progress, long totalBytes, Stopwatch stopwatch, string partPath)
        {
            var directory = Path.GetDirectoryName(partPath)!;
            var prefix = Path.GetFileNameWithoutExtension(partPath);
            var downloaded = Directory.GetFiles(directory, $"{prefix}.part*").Sum(path => new FileInfo(path).Length);
            var speed = stopwatch.Elapsed.TotalSeconds <= 0 ? 0 : downloaded / stopwatch.Elapsed.TotalSeconds;
            var remainingSeconds = speed <= 0 ? 0 : (totalBytes - downloaded) / speed;
            progress.Report(new DownloadProgress
            {
                DownloadedBytes = downloaded,
                TotalBytes = totalBytes,
                BytesPerSecond = speed,
                Eta = TimeSpan.FromSeconds(Math.Max(0, remainingSeconds)),
            });
        }

        private static void MergeChunks(IEnumerable<DownloadChunk> chunks, string targetPath)
        {
            using var output = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None);
            foreach (var chunk in chunks.OrderBy(item => item.Start))
            {
                using var input = new FileStream(chunk.PartPath, FileMode.Open, FileAccess.Read, FileShare.Read);
                input.CopyTo(output);
                File.Delete(chunk.PartPath);
            }
        }

        private static void EnsureDiskSpace(string targetPath, long expectedSize)
        {
            var root = Path.GetPathRoot(Path.GetFullPath(targetPath)) ?? "";
            var drive = new DriveInfo(root);
            if (drive.AvailableFreeSpace < expectedSize)
            {
                throw new IOException($"Not enough free disk space. Required {FormatBytes(expectedSize)}, available {FormatBytes(drive.AvailableFreeSpace)}.");
            }
        }

        private static async Task<string> ComputeSha256Async(string path, CancellationToken cancellationToken)
        {
            await using var stream = File.OpenRead(path);
            var hash = await SHA256.HashDataAsync(stream, cancellationToken);
            return Convert.ToHexString(hash).ToLowerInvariant();
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

        private sealed record DownloadChunk(long Start, long End, string PartPath);
    }
}
