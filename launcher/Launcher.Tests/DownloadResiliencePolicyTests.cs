using Launcher;
using Xunit;

namespace Launcher.Tests;

public class DownloadResiliencePolicyTests
{
    [Fact]
    public void ResolveParallelStreamCount_UsesRequestedWhenAdaptiveDisabled()
    {
        var result = DownloadResiliencePolicy.ResolveParallelStreamCount(
            requestedStreams: 12,
            minimumStreams: 4,
            totalBytes: 8L * 1024 * 1024 * 1024,
            bandwidthLimitBytesPerSecond: 0,
            adaptiveEnabled: false);

        Assert.Equal(12, result);
    }

    [Fact]
    public void ResolveParallelStreamCount_ReducesSmallPackages()
    {
        var result = DownloadResiliencePolicy.ResolveParallelStreamCount(
            requestedStreams: 16,
            minimumStreams: 4,
            totalBytes: 100L * 1024 * 1024,
            bandwidthLimitBytesPerSecond: 0,
            adaptiveEnabled: true);

        Assert.Equal(8, result);
    }

    [Fact]
    public void ResolveParallelStreamCount_ReducesMediumPackages()
    {
        var result = DownloadResiliencePolicy.ResolveParallelStreamCount(
            requestedStreams: 16,
            minimumStreams: 4,
            totalBytes: 1024L * 1024 * 1024,
            bandwidthLimitBytesPerSecond: 0,
            adaptiveEnabled: true);

        Assert.Equal(12, result);
    }

    [Fact]
    public void ResolveParallelStreamCount_ReducesLowBandwidthCaps()
    {
        var result = DownloadResiliencePolicy.ResolveParallelStreamCount(
            requestedStreams: 16,
            minimumStreams: 4,
            totalBytes: 10L * 1024 * 1024 * 1024,
            bandwidthLimitBytesPerSecond: 8L * 1024 * 1024,
            adaptiveEnabled: true);

        Assert.Equal(4, result);
    }

    [Fact]
    public void ResolveParallelStreamCount_RespectsMinimumStreamFloor()
    {
        var result = DownloadResiliencePolicy.ResolveParallelStreamCount(
            requestedStreams: 16,
            minimumStreams: 6,
            totalBytes: 10L * 1024 * 1024 * 1024,
            bandwidthLimitBytesPerSecond: 8L * 1024 * 1024,
            adaptiveEnabled: true);

        Assert.Equal(6, result);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(5)]
    public void ChunkRetryDelay_StaysInExpectedBounds(int attempt)
    {
        var delay = DownloadResiliencePolicy.GetChunkRetryDelay(attempt, maxChunkAttempts: 5);

        Assert.True(delay >= TimeSpan.FromMilliseconds(1400), $"Delay was too low: {delay.TotalMilliseconds}ms");
        Assert.True(delay <= TimeSpan.FromMilliseconds(12000), $"Delay was too high: {delay.TotalMilliseconds}ms");
    }

    [Theory]
    [InlineData(1, 1750, 2450)]
    [InlineData(2, 3250, 3950)]
    [InlineData(3, 6250, 6950)]
    public void SessionRetryDelay_UsesExponentialBackoffWithJitterWindow(int attempt, int minMs, int maxMs)
    {
        var delay = DownloadResiliencePolicy.GetSessionRetryDelay(attempt);

        Assert.True(delay >= TimeSpan.FromMilliseconds(minMs), $"Delay was below expected minimum: {delay.TotalMilliseconds}ms");
        Assert.True(delay <= TimeSpan.FromMilliseconds(maxMs), $"Delay was above expected maximum: {delay.TotalMilliseconds}ms");
    }

    [Fact]
    public void SessionRetryDelay_IsCapped()
    {
        var delay = DownloadResiliencePolicy.GetSessionRetryDelay(10);
        Assert.True(delay <= TimeSpan.FromMilliseconds(12000));
    }

    [Fact]
    public void SessionRetryStep_IntegrationStyleFallbackProgression_IsCorrect()
    {
        // Simulate repeated transient failures in the launcher retry loop.
        var configuredMaxStreams = 12;
        var currentStreams = configuredMaxStreams;

        var first = DownloadResiliencePolicy.GetSessionRetryStep(currentStreams, configuredMaxStreams, attempt: 1);
        currentStreams = first.NextStreams;

        var second = DownloadResiliencePolicy.GetSessionRetryStep(currentStreams, configuredMaxStreams, attempt: 2);
        currentStreams = second.NextStreams;

        var third = DownloadResiliencePolicy.GetSessionRetryStep(currentStreams, configuredMaxStreams, attempt: 3);

        Assert.Equal(10, first.NextStreams);
        Assert.Equal(8, second.NextStreams);
        Assert.Equal(6, third.NextStreams);

        Assert.True(first.Delay >= TimeSpan.FromMilliseconds(1750));
        Assert.True(second.Delay >= TimeSpan.FromMilliseconds(3250));
        Assert.True(third.Delay >= TimeSpan.FromMilliseconds(6250));
    }

    [Fact]
    public void SessionRetryStep_NeverDropsBelowMinimum_WhenFailuresContinue()
    {
        var configuredMaxStreams = 8;
        var currentStreams = configuredMaxStreams;

        for (var attempt = 1; attempt <= 10; attempt++)
        {
            var step = DownloadResiliencePolicy.GetSessionRetryStep(currentStreams, configuredMaxStreams, attempt);
            currentStreams = step.NextStreams;
        }

        Assert.Equal(4, currentStreams);
    }
}
