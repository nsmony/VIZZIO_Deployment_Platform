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
    // Immutable progress snapshot emitted to the WPF UI thread.
    public sealed class DownloadProgress
    {
        public long DownloadedBytes { get; init; }
        public long TotalBytes { get; init; }
        public double BytesPerSecond { get; init; }
        public TimeSpan Eta { get; init; }
        public double Percent => TotalBytes <= 0 ? 0 : Math.Min(100, DownloadedBytes * 100d / TotalBytes);
    }

    public sealed class DownloadOptions
    {
        // Steam-style downloads benefit from multiple streams, but the launcher
        // clamps this value so company networks are not overwhelmed.
        public int ParallelStreams { get; init; } = 4;

        // Allows the downloader to tune stream count for file size and bandwidth
        // so small or constrained downloads avoid unnecessary contention.
        public bool EnableAdaptiveStreamScaling { get; init; } = true;

        // Floor used when adaptive scaling lowers stream count on constrained
        // links. This still respects the launcher minimum of 4 streams.
        public int MinimumParallelStreams { get; init; } = 4;

        // A value of 0 means "unlimited". When set, the cap is shared across all
        // chunks so four streams do not accidentally become four full-speed caps.
        public long BandwidthLimitBytesPerSecond { get; init; }
    }

    // Downloads large packages using HTTP byte ranges. Completed bytes remain in
    // .part files, which is what makes resume work after network loss or restart.
    public sealed class ChunkedDownloadManager
    {
        private const int MinChunkCount = DownloadResiliencePolicy.MinChunkCount;
        private const int MaxChunkCount = DownloadResiliencePolicy.MaxChunkCount;
        private const int MaxChunkAttempts = 5;
        private const int MaxChunkRepairPasses = 1;
        private static readonly TimeSpan ProgressReportInterval = TimeSpan.FromMilliseconds(250);
        private readonly HttpClient _httpClient = new()
        {
            Timeout = Timeout.InfiniteTimeSpan,
        };

        public void CancelActiveRequests()
        {
            _httpClient.CancelPendingRequests();
            LauncherLog.Info("All active HTTP requests were asked to cancel.");
        }

        public async Task<string> DownloadAsync(
            Uri source,
            string targetPath,
            long expectedSize,
            string? expectedSha256,
            IProgress<DownloadProgress> progress,
            ManualResetEventSlim pauseGate,
            CancellationToken cancellationToken,
            DownloadOptions? options = null)
        {
            return await DownloadAsync(() => Task.FromResult(source), targetPath, expectedSize, expectedSha256, progress, pauseGate, cancellationToken, options).ConfigureAwait(false);
        }

        public async Task<string> DownloadAsync(
            Func<Task<Uri>> sourceFactory,
            string targetPath,
            long expectedSize,
            string? expectedSha256,
            IProgress<DownloadProgress> progress,
            ManualResetEventSlim pauseGate,
            CancellationToken cancellationToken,
            DownloadOptions? options = null)
        {
            options ??= new DownloadOptions();

            // Keep the caller-facing option flexible, but enforce launcher-wide
            // limits here so every download path behaves consistently.
            var requestedStreams = Math.Clamp(options.ParallelStreams, MinChunkCount, MaxChunkCount);
            var bandwidthLimiter = options.BandwidthLimitBytesPerSecond > 0
                ? new BandwidthLimiter(options.BandwidthLimitBytesPerSecond)
                : null;

            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
            EnsureDiskSpace(targetPath, expectedSize);

            var totalBytes = expectedSize > 0 ? expectedSize : await GetRemoteLengthAsync(await sourceFactory().ConfigureAwait(false), cancellationToken).ConfigureAwait(false);
            var parallelStreams = DownloadResiliencePolicy.ResolveParallelStreamCount(requestedStreams, options.MinimumParallelStreams, totalBytes, options.BandwidthLimitBytesPerSecond, options.EnableAdaptiveStreamScaling);
            LauncherLog.Info($"Downloader using {parallelStreams} stream(s) for {FormatBytes(totalBytes)}.");
            if (!await SupportsRangeRequestsAsync(await sourceFactory().ConfigureAwait(false), cancellationToken).ConfigureAwait(false))
            {
                // Fallback for simple file servers. This path cannot resume as
                // precisely because the server refused byte-range requests.
                return await DownloadSingleStreamAsync(sourceFactory, targetPath, totalBytes, expectedSha256, progress, pauseGate, bandwidthLimiter, cancellationToken).ConfigureAwait(false);
            }

            try
            {
                // Each chunk writes to its own .part file. That keeps concurrent
                // writes independent and makes resume state easy to inspect.
                var chunks = CreateChunks(totalBytes, targetPath, parallelStreams);
                var stopwatch = Stopwatch.StartNew();
                var progressState = new ProgressReportState();

                await Task.WhenAll(chunks.Select(chunk => DownloadChunkAsync(sourceFactory, chunk, progress, pauseGate, bandwidthLimiter, stopwatch, progressState, totalBytes, cancellationToken))).ConfigureAwait(false);
                cancellationToken.ThrowIfCancellationRequested();
                MergeChunks(chunks, targetPath);
                ReportProgress(progress, totalBytes, stopwatch, totalBytes);
                LauncherLog.Info($"Download completed: {targetPath}");

                if (!string.IsNullOrWhiteSpace(expectedSha256))
                {
                    // The backend checksum is the final guard after transport
                    // retries, range validation, and chunk merging have finished.
                    var actual = await ComputeSha256Async(targetPath, cancellationToken).ConfigureAwait(false);
                    if (!string.Equals(actual, expectedSha256, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidDataException("Downloaded file checksum did not match. Please re-download the package.");
                    }
                }

                return targetPath;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (InvalidDataException)
            {
                throw;
            }
        }

        private async Task<bool> SupportsRangeRequestsAsync(Uri source, CancellationToken cancellationToken)
        {
            // Ask for one byte instead of trusting Accept-Ranges; some servers
            // omit that header but still support byte-range responses correctly.
            using var request = new HttpRequestMessage(HttpMethod.Get, source);
            request.Headers.Range = new RangeHeaderValue(0, 0);
            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
            if (response.StatusCode == HttpStatusCode.PartialContent) return true;
            response.EnsureSuccessStatusCode();
            return false;
        }

        private async Task<long> GetRemoteLengthAsync(Uri source, CancellationToken cancellationToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Head, source);
            using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                // A few storage providers reject HEAD. A 0-0 range request still
                // exposes Content-Range, including the full file length.
                using var rangeRequest = new HttpRequestMessage(HttpMethod.Get, source);
                rangeRequest.Headers.Range = new RangeHeaderValue(0, 0);
                using var rangeResponse = await _httpClient.SendAsync(rangeRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
                if (rangeResponse.Content.Headers.ContentRange?.Length is long rangeLength) return rangeLength;
                rangeResponse.EnsureSuccessStatusCode();
            }
            return response.Content.Headers.ContentLength ?? throw new InvalidOperationException("Server did not provide a file size.");
        }

        private static List<DownloadChunk> CreateChunks(long totalBytes, string targetPath, int chunkCount)
        {
            if (totalBytes <= 0)
            {
                throw new InvalidOperationException("Server did not provide a valid file size.");
            }

            chunkCount = (int)Math.Min(Math.Clamp(chunkCount, MinChunkCount, MaxChunkCount), totalBytes);
            var chunkSize = Math.Max(1, totalBytes / chunkCount);
            var chunks = new List<DownloadChunk>();
            for (var i = 0; i < chunkCount; i++)
            {
                // Ranges are inclusive in HTTP, so the final byte is total - 1.
                // The last chunk absorbs any remainder from integer division.
                var start = i * chunkSize;
                var end = i == chunkCount - 1 ? totalBytes - 1 : Math.Min(totalBytes - 1, start + chunkSize - 1);
                chunks.Add(new DownloadChunk(start, end, $"{targetPath}.part{i}"));
            }
            return chunks;
        }

        private async Task DownloadChunkAsync(
            Func<Task<Uri>> sourceFactory,
            DownloadChunk chunk,
            IProgress<DownloadProgress> progress,
            ManualResetEventSlim pauseGate,
            BandwidthLimiter? bandwidthLimiter,
            Stopwatch stopwatch,
            ProgressReportState progressState,
            long totalBytes,
            CancellationToken cancellationToken)
        {
            Exception? lastError = null;
            for (var repairPass = 0; repairPass <= MaxChunkRepairPasses; repairPass++)
            {
                for (var attempt = 1; attempt <= MaxChunkAttempts; attempt++)
                {
                    try
                    {
                        NormalizePartFile(chunk);
                        var existing = File.Exists(chunk.PartPath) ? new FileInfo(chunk.PartPath).Length : 0;
                        // Resume from the saved partial size instead of
                        // redownloading a whole chunk after network loss.
                        var start = chunk.Start + existing;
                        if (start > chunk.End) return;

                        cancellationToken.ThrowIfCancellationRequested();
                        using var request = new HttpRequestMessage(HttpMethod.Get, await sourceFactory().ConfigureAwait(false));
                        request.Headers.Range = new RangeHeaderValue(start, chunk.End);
                        LauncherLog.Info($"Stream started: bytes {start}-{chunk.End} -> {chunk.PartPath}");
                        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);

                        if (response.StatusCode == HttpStatusCode.RequestedRangeNotSatisfiable)
                        {
                            throw new InvalidChunkStateException($"Saved partial chunk no longer matches the server range for bytes {chunk.Start}-{chunk.End}.");
                        }

                        if (response.StatusCode != HttpStatusCode.PartialContent)
                        {
                            throw new IOException($"Server returned {(int)response.StatusCode} {response.StatusCode} for range bytes {start}-{chunk.End}.");
                        }

                        // Validate the server actually honored the requested
                        // range before appending bytes to the partial file.
                        ValidateContentRange(response, start, chunk.End, totalBytes);

                        await using var input = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
                        await using var output = new FileStream(chunk.PartPath, FileMode.Append, FileAccess.Write, FileShare.Read, 1024 * 128, true);
                        var buffer = new byte[1024 * 128];
                        while (true)
                        {
                            await WaitForResumeAsync(pauseGate, cancellationToken).ConfigureAwait(false);
                            var read = await input.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
                            if (read == 0) break;
                            cancellationToken.ThrowIfCancellationRequested();
                            await WaitForResumeAsync(pauseGate, cancellationToken).ConfigureAwait(false);

                            // Throttle before writing so the on-disk byte count
                            // never races ahead of the visible transfer budget.
                            if (bandwidthLimiter is not null)
                            {
                                await bandwidthLimiter.WaitAsync(read, cancellationToken).ConfigureAwait(false);
                            }
                            cancellationToken.ThrowIfCancellationRequested();
                            await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken).ConfigureAwait(false);
                            if (ShouldReportProgress(progressState, force: false))
                            {
                                ReportProgress(progress, totalBytes, stopwatch, chunk.PartPath);
                            }
                        }

                        var expectedPartSize = chunk.End - chunk.Start + 1;
                        var actualPartSize = File.Exists(chunk.PartPath) ? new FileInfo(chunk.PartPath).Length : 0;
                        if (actualPartSize >= expectedPartSize)
                        {
                            ReportProgress(progress, totalBytes, stopwatch, chunk.PartPath);
                            return;
                        }

                        throw new IOException($"Download stream ended early for bytes {chunk.Start}-{chunk.End}; received {actualPartSize} of {expectedPartSize} bytes.");
                    }
                    catch (OperationCanceledException)
                    {
                        var saved = File.Exists(chunk.PartPath) ? new FileInfo(chunk.PartPath).Length : 0;
                        var expectedPartSize = chunk.End - chunk.Start + 1;
                        LauncherLog.Info($"Stream cancelled: bytes {chunk.Start}-{chunk.End}; saved {saved} of {expectedPartSize} bytes in {chunk.PartPath}");
                        throw;
                    }
                    catch (Exception ex) when (attempt < MaxChunkAttempts)
                    {
                        lastError = ex;
                        await Task.Delay(DownloadResiliencePolicy.GetChunkRetryDelay(attempt, MaxChunkAttempts), cancellationToken).ConfigureAwait(false);
                    }
                    catch (Exception ex)
                    {
                        lastError = ex;
                    }
                }

                if (repairPass < MaxChunkRepairPasses && File.Exists(chunk.PartPath))
                {
                    // If a partial file is corrupt or no longer matches the
                    // server range, delete just that chunk and retry it once.
                    File.Delete(chunk.PartPath);
                    lastError = new IOException($"Re-downloading one stuck chunk after repeated resume failures: {lastError?.Message ?? "unknown error"}", lastError);
                    continue;
                }

                break;
            }

            throw new IOException($"The connection failed while downloading bytes {chunk.Start}-{chunk.End}: {lastError?.Message ?? "unknown error"}", lastError);
        }

        private static void ValidateContentRange(HttpResponseMessage response, long expectedStart, long expectedEnd, long totalBytes)
        {
            var range = response.Content.Headers.ContentRange;
            if (range is null) return;

            // A mismatched Content-Range usually means a proxy, CDN, or stale URL
            // served a different object than the one the backend registered.
            if (range.From != expectedStart || range.To != expectedEnd)
            {
                throw new IOException($"Server returned range bytes {range.From}-{range.To}, expected bytes {expectedStart}-{expectedEnd}.");
            }

            if (range.Length.HasValue && range.Length.Value != totalBytes)
            {
                throw new IOException($"Server reported file size {range.Length.Value}, expected {totalBytes}.");
            }
        }

        private async Task<string> DownloadSingleStreamAsync(
            Func<Task<Uri>> sourceFactory,
            string targetPath,
            long totalBytes,
            string? expectedSha256,
            IProgress<DownloadProgress> progress,
            ManualResetEventSlim pauseGate,
            BandwidthLimiter? bandwidthLimiter,
            CancellationToken cancellationToken)
        {
            // Single-stream mode is intentionally simpler: no .part files are
            // kept because the server cannot prove it can resume byte ranges.
            DeletePartFiles(targetPath);
            var tempPath = $"{targetPath}.download";
            var stopwatch = Stopwatch.StartNew();
            var progressState = new ProgressReportState();
            long downloaded = 0;

            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                using var request = new HttpRequestMessage(HttpMethod.Get, await sourceFactory().ConfigureAwait(false));
                LauncherLog.Info($"Single stream started: {targetPath}");
                using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
                response.EnsureSuccessStatusCode();

                await using var input = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
                await using (var output = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.Read, 1024 * 128, true))
                {
                    var buffer = new byte[1024 * 128];
                    while (true)
                    {
                        await WaitForResumeAsync(pauseGate, cancellationToken).ConfigureAwait(false);
                        var read = await input.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
                        if (read == 0) break;
                        cancellationToken.ThrowIfCancellationRequested();
                        await WaitForResumeAsync(pauseGate, cancellationToken).ConfigureAwait(false);

                        // The same limiter is reused here so UI settings apply even
                        // when the server does not support chunked downloads.
                        if (bandwidthLimiter is not null)
                        {
                            await bandwidthLimiter.WaitAsync(read, cancellationToken).ConfigureAwait(false);
                        }
                        cancellationToken.ThrowIfCancellationRequested();
                        await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken).ConfigureAwait(false);
                        downloaded += read;
                        if (ShouldReportProgress(progressState, force: false))
                        {
                            ReportProgress(progress, totalBytes, stopwatch, downloaded);
                        }
                    }
                }
                ReportProgress(progress, totalBytes, stopwatch, downloaded);

                if (totalBytes > 0 && downloaded < totalBytes)
                {
                    throw new IOException("Download stream ended early.");
                }

                cancellationToken.ThrowIfCancellationRequested();
                if (File.Exists(targetPath)) File.Delete(targetPath);
                File.Move(tempPath, targetPath);
                LauncherLog.Info($"Download completed: {targetPath}");

                if (!string.IsNullOrWhiteSpace(expectedSha256))
                {
                    var actual = await ComputeSha256Async(targetPath, cancellationToken).ConfigureAwait(false);
                    if (!string.Equals(actual, expectedSha256, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidDataException("Downloaded file checksum did not match. Please re-download the package.");
                    }
                }

                return targetPath;
            }
            catch (OperationCanceledException)
            {
                var saved = File.Exists(tempPath) ? new FileInfo(tempPath).Length : downloaded;
                LauncherLog.Info($"Single stream cancelled: saved {saved} bytes in {tempPath}");
                throw;
            }
        }

        private static void NormalizePartFile(DownloadChunk chunk)
        {
            if (!File.Exists(chunk.PartPath)) return;

            // If a previous run wrote too many bytes before failing, trim the
            // file back to the exact chunk size before calculating resume offset.
            var expectedPartSize = chunk.End - chunk.Start + 1;
            var actualPartSize = new FileInfo(chunk.PartPath).Length;
            if (actualPartSize <= expectedPartSize) return;

            using var stream = new FileStream(chunk.PartPath, FileMode.Open, FileAccess.Write, FileShare.Read);
            stream.SetLength(expectedPartSize);
        }

        private static void ReportProgress(IProgress<DownloadProgress> progress, long totalBytes, Stopwatch stopwatch, string partPath)
        {
            // Progress is aggregated from all sibling .part files so every
            // parallel stream contributes to a single UI progress snapshot.
            var directory = Path.GetDirectoryName(partPath)!;
            var prefix = Path.GetFileNameWithoutExtension(partPath);
            var downloaded = Directory.GetFiles(directory, $"{prefix}.part*").Sum(path => new FileInfo(path).Length);
            ReportProgress(progress, totalBytes, stopwatch, downloaded);
        }

        private static void ReportProgress(IProgress<DownloadProgress> progress, long totalBytes, Stopwatch stopwatch, long downloaded)
        {
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

        private static bool ShouldReportProgress(ProgressReportState state, bool force)
        {
            if (force) return true;

            // All chunk tasks share this timestamp; the lock prevents a burst of
            // simultaneous progress events every time several streams write.
            var now = DateTimeOffset.UtcNow;
            lock (state)
            {
                if (now - state.LastReportAt < ProgressReportInterval) return false;
                state.LastReportAt = now;
                return true;
            }
        }

        private static void DeletePartFiles(string targetPath)
        {
            var directory = Path.GetDirectoryName(targetPath);
            var fileName = Path.GetFileName(targetPath);
            if (string.IsNullOrWhiteSpace(directory) || string.IsNullOrWhiteSpace(fileName) || !Directory.Exists(directory)) return;

            // Only delete files for this target package. Other downloads in the
            // same install directory may still have valid resume data.
            foreach (var partPath in Directory.EnumerateFiles(directory, $"{fileName}.part*"))
            {
                File.Delete(partPath);
            }
        }

        private static async Task WaitForResumeAsync(ManualResetEventSlim pauseGate, CancellationToken cancellationToken)
        {
            // ManualResetEventSlim.Wait would block a worker thread; polling with
            // Task.Delay keeps pause responsive without freezing the WPF UI.
            while (!pauseGate.IsSet)
            {
                await Task.Delay(100, cancellationToken).ConfigureAwait(false);
            }
        }

        private static void MergeChunks(IEnumerable<DownloadChunk> chunks, string targetPath)
        {
            // Merge only after every chunk completed. Part files are deleted
            // after the output stream is closed so Windows file locks are gone.
            using var output = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None);
            var mergedChunks = new List<DownloadChunk>();
            foreach (var chunk in chunks.OrderBy(item => item.Start))
            {
                using (var input = new FileStream(chunk.PartPath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    input.CopyTo(output);
                }
                mergedChunks.Add(chunk);
            }

            output.Flush();
            foreach (var chunk in mergedChunks)
            {
                File.Delete(chunk.PartPath);
            }
        }

        private static void EnsureDiskSpace(string targetPath, long expectedSize)
        {
            // Check the drive that will receive the final package, not just the
            // current working directory where the launcher happens to run.
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

        private sealed class InvalidChunkStateException : IOException
        {
            public InvalidChunkStateException(string message)
                : base(message)
            {
            }
        }

        private sealed class ProgressReportState
        {
            public DateTimeOffset LastReportAt { get; set; } = DateTimeOffset.MinValue;
        }

        private sealed class BandwidthLimiter
        {
            private readonly long _bytesPerSecond;
            private readonly Stopwatch _stopwatch = Stopwatch.StartNew();
            private long _reservedBytes;

            public BandwidthLimiter(long bytesPerSecond)
            {
                _bytesPerSecond = Math.Max(1, bytesPerSecond);
            }

            public async Task WaitAsync(int byteCount, CancellationToken cancellationToken)
            {
                // Shared reservation model: all parallel streams draw from one
                // company-friendly bandwidth budget instead of each stream using
                // the full cap independently.
                TimeSpan delay;
                lock (this)
                {
                    _reservedBytes += byteCount;
                    var expectedElapsed = TimeSpan.FromSeconds((double)_reservedBytes / _bytesPerSecond);
                    delay = expectedElapsed - _stopwatch.Elapsed;
                }

                if (delay > TimeSpan.Zero)
                {
                    await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
                }
            }
        }
    }
}
