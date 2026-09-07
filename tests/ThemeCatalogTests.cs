using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class ThemeCatalogTests
{
    private const string Bundled = "[{\"name\":\"Sakura\",\"vars\":{\"--surface\":\"old\"}},{\"name\":\"Offline\",\"vars\":{}}]";
    private static int assertions;

    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
        assertions++;
    }

    private static Dictionary<string, object> Find(string json, string name)
    {
        foreach (Dictionary<string, object> item in (object[])new JavaScriptSerializer().DeserializeObject(json))
            if (Equals(item["name"], name)) return item;
        return null;
    }

    private static Task<string> Offline(string url, CancellationToken token)
    {
        throw new IOException("Simulated network failure / rate limit");
    }

    private static async Task Run(string directory)
    {
        Directory.CreateDirectory(directory);
        string cache = Path.Combine(directory, "github-themes.json");
        var logs = new List<string>();
        var requests = new List<string>();
        Func<string, CancellationToken, Task<string>> download = (url, token) =>
        {
            requests.Add(url);
            Assert(token.CanBeCanceled, "Downloads must have a deadline.");
            if (url == ThemeCatalog.ListingUrl)
                return Task.FromResult("[{\"type\":\"file\",\"name\":\"sakura.json\",\"download_url\":\"https://example.invalid/ignored\"},{\"type\":\"file\",\"name\":\"new theme.json\"},{\"type\":\"file\",\"name\":\"broken.json\"},{\"type\":\"file\",\"name\":\"bad-vars.json\"},{\"type\":\"dir\",\"name\":\"folder.json\"},{\"type\":\"file\",\"name\":\"readme.md\"},{\"type\":\"file\",\"name\":\"../escape.json\"}]");
            if (url.EndsWith("sakura.json")) return Task.FromResult("{\"name\":\"Sakura\",\"vars\":{\"--surface\":\"updated\"}}");
            if (url.EndsWith("new%20theme.json")) return Task.FromResult("{\"name\":\"New\",\"vars\":{}}");
            if (url.EndsWith("bad-vars.json")) return Task.FromResult("{\"name\":\"Bad\",\"vars\":{\"--x\":42}}");
            return Task.FromResult("invalid json");
        };

        string result = await ThemeCatalog.LoadAsync(Bundled, cache, logs.Add, download);
        Assert(Equals(((Dictionary<string, object>)Find(result, "Sakura")["vars"])["--surface"], "updated"), "GitHub should update bundled presets.");
        Assert(Find(result, "New") != null && Find(result, "Offline") != null, "New and offline presets must be available.");
        Assert(Find(result, "Bad") == null, "Invalid CSS values must be skipped.");
        Assert(requests.Count == 5, "Only direct JSON files should be downloaded.");
        Assert(File.Exists(cache), "Successful downloads must be cached.");
        Assert(logs.Exists(line => line.Contains("Skipping GitHub theme broken.json")), "Invalid JSON should be logged.");
        string cached = File.ReadAllText(cache);

        result = await ThemeCatalog.LoadAsync(Bundled, cache, logs.Add, Offline);
        Assert(Find(result, "New") != null, "Offline startup must retain downloaded presets.");
        Assert(Equals(((Dictionary<string, object>)Find(result, "Sakura")["vars"])["--surface"], "updated"), "Offline startup must not revert cached updates.");
        Assert(File.ReadAllText(cache) == cached, "Network failure must not overwrite the cache.");

        result = await ThemeCatalog.LoadAsync(Bundled, cache, logs.Add, (url, token) => Task.FromResult("{}"));
        Assert(Find(result, "New") != null, "API error responses must preserve cached presets.");

        result = await ThemeCatalog.LoadAsync(Bundled, cache, logs.Add, (url, token) =>
        {
            throw new OperationCanceledException("Simulated timeout");
        });
        Assert(Find(result, "New") != null, "Timeout must fall back to the cache.");

        // A valid refresh replaces the previous cache atomically.
        await ThemeCatalog.LoadAsync(Bundled, cache, logs.Add, download);
        Assert(File.ReadAllText(cache) == cached, "Repeated refresh must not duplicate themes.");

        File.WriteAllText(cache, "broken cache");
        result = await ThemeCatalog.LoadAsync(Bundled, cache, logs.Add, Offline);
        Assert(Find(result, "Sakura") != null && Find(result, "Offline") != null, "Corrupt cache must fall back to bundled presets.");

        // An unwritable cache path must not discard successfully downloaded themes.
        string blocked = Path.Combine(directory, "blocked");
        File.WriteAllText(blocked, "file, not directory");
        result = await ThemeCatalog.LoadAsync(Bundled, Path.Combine(blocked, "cache.json"), logs.Add, download);
        Assert(Find(result, "New") != null, "Cache write failure must still return downloaded themes.");
        Console.WriteLine("Passed " + assertions + " assertions.");
    }

    private static int Main(string[] args)
    {
        try
        {
            Run(args[0]).GetAwaiter().GetResult();
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception);
            return 1;
        }
    }
}
