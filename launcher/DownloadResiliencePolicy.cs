using System;
using System.Runtime.CompilerServices;

[assembly: InternalsVisibleTo("Launcher.Tests")]

namespace Launcher
{
    internal static class DownloadResiliencePolicy
    {
        internal const int MinChunkCount = 4;
        internal const int MaxChunkCount = 16;

        internal readonly record struct SessionRetryStep(int NextStreams, TimeSpan Delay);

        internal static int ResolveParallelStreamCount(int requestedStreams, int minimumStreams, long totalBytes, long bandwidthLimitBytesPerSecond, bool adaptiveEnabled)
        {
            var minStreams = Math.Clamp(minimumStreams, MinChunkCount, MaxChunkCount);
            var boundedRequested = Math.Clamp(requestedStreams, minStreams, MaxChunkCount);
            if (!adaptiveEnabled)
            {
                return boundedRequested;
            }

            var selected = boundedRequested;

            // Smaller packages and low shared caps often download faster with
            // fewer streams due to reduced seek and socket overhead.
            if (totalBytes > 0 && totalBytes < 512L * 1024 * 1024)
            {
                selected = Math.Min(selected, 8);
            }
            else if (totalBytes > 0 && totalBytes < 2L * 1024 * 1024 * 1024)
            {
                selected = Math.Min(selected, 12);
            }

            if (bandwidthLimitBytesPerSecond > 0)
            {
                var capMbps = bandwidthLimitBytesPerSecond / 1024d / 1024d;
                if (capMbps <= 8)
                {
                    selected = Math.Min(selected, 4);
                }
                else if (capMbps <= 20)
                {
                    selected = Math.Min(selected, 6);
                }
            }

            return Math.Clamp(selected, minStreams, MaxChunkCount);
        }

        internal static TimeSpan GetChunkRetryDelay(int attempt, int maxChunkAttempts)
        {
            var boundedAttempt = Math.Clamp(attempt, 1, Math.Max(1, maxChunkAttempts));
            var baseDelayMs = 1200 * Math.Pow(2, boundedAttempt - 1);
            var jitterMs = Random.Shared.Next(200, 900);
            var totalMs = Math.Min(12_000, (int)baseDelayMs + jitterMs);
            return TimeSpan.FromMilliseconds(totalMs);
        }

        internal static TimeSpan GetSessionRetryDelay(int attempt)
        {
            var boundedAttempt = Math.Clamp(attempt, 1, 6);
            var baseDelayMs = 1500 * Math.Pow(2, boundedAttempt - 1);
            var jitterMs = Random.Shared.Next(250, 950);
            var totalMs = Math.Min(12_000, (int)baseDelayMs + jitterMs);
            return TimeSpan.FromMilliseconds(totalMs);
        }

        internal static SessionRetryStep GetSessionRetryStep(int currentStreams, int configuredMaxStreams, int attempt)
        {
            var maxStreams = Math.Clamp(configuredMaxStreams, MinChunkCount, MaxChunkCount);
            var boundedCurrent = Math.Clamp(currentStreams, MinChunkCount, maxStreams);
            var nextStreams = Math.Clamp(boundedCurrent - 2, MinChunkCount, maxStreams);
            return new SessionRetryStep(nextStreams, GetSessionRetryDelay(attempt));
        }
    }
}
