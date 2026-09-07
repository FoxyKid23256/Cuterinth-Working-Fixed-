using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class ThemeCatalog
{
    internal const string ListingUrl = "https://api.github.com/repos/FoxyKid23256/Cuterinth-Working-Fixed-/contents/themes?ref=main";
    private const string RawBaseUrl = "https://raw.githubusercontent.com/FoxyKid23256/Cuterinth-Working-Fixed-/main/themes/";
    private const int MaxBytes = 5 * 1024 * 1024;

    internal static async Task<string> LoadAsync(
        string bundledJson, string cachePath, Action<string> log,
        Func<string, CancellationToken, Task<string>> download = null)
    {
        var serializer = new JavaScriptSerializer { MaxJsonLength = MaxBytes };
        var themes = ReadThemes(bundledJson, serializer);
        var cached = new Dictionary<string, object>(StringComparer.Ordinal);
        try
        {
            if (File.Exists(cachePath))
            {
                if (new FileInfo(cachePath).Length > MaxBytes)
                    throw new InvalidDataException("Theme cache is too large.");
                cached = ReadThemes(File.ReadAllText(cachePath, Encoding.UTF8), serializer);
            }
        }
        catch (Exception exception)
        {
            log("Ignoring unreadable GitHub theme cache: " + exception.Message);
        }

        // One deadline covers both discovery and all theme files.
        using (var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15)))
        using (var client = new HttpClient())
        {
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Cuterinth/1.0");
            client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
            client.MaxResponseContentBufferSize = MaxBytes;
            if (download == null)
                download = async (url, token) =>
                {
                    using (var response = await client.GetAsync(url, token))
                    {
                        response.EnsureSuccessStatusCode();
                        return await response.Content.ReadAsStringAsync();
                    }
                };

            int downloaded = 0;
            try
            {
                string listingJson = await download(ListingUrl, deadline.Token);
                var listing = serializer.DeserializeObject(listingJson) as object[];
                if (listing == null) throw new InvalidDataException("Invalid GitHub directory listing.");
                foreach (object item in listing)
                {
                    var entry = item as Dictionary<string, object>;
                    object type;
                    object nameValue;
                    if (entry == null || !entry.TryGetValue("type", out type) ||
                        !Equals(type, "file") || !entry.TryGetValue("name", out nameValue)) continue;
                    string name = nameValue as string;
                    if (string.IsNullOrEmpty(name) || !name.EndsWith(".json", StringComparison.OrdinalIgnoreCase) ||
                        name.IndexOfAny(new[] { '/', '\\' }) >= 0) continue;

                    deadline.Token.ThrowIfCancellationRequested();
                    try
                    {
                        // Construct the URL ourselves; only fetch JSON from the configured folder.
                        string json = await download(RawBaseUrl + Uri.EscapeDataString(name), deadline.Token);
                        var theme = ValidateTheme(serializer.DeserializeObject(json));
                        var candidate = new Dictionary<string, object>(cached, StringComparer.Ordinal);
                        candidate[(string)theme["name"]] = theme;
                        SerializeThemes(candidate, serializer); // Bound the combined cache, too.
                        cached = candidate;
                        downloaded++;
                    }
                    catch (OperationCanceledException) { throw; }
                    catch (Exception exception)
                    {
                        log("Skipping GitHub theme " + name + ": " + exception.Message);
                    }
                }
            }
            catch (Exception exception)
            {
                log("GitHub theme refresh unavailable; using cached and bundled themes: " + exception.Message);
            }

            if (downloaded > 0)
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(cachePath));
                    string temporaryPath = cachePath + ".tmp";
                    File.WriteAllText(temporaryPath, SerializeThemes(cached, serializer), new UTF8Encoding(false));
                    if (File.Exists(cachePath)) File.Replace(temporaryPath, cachePath, null);
                    else File.Move(temporaryPath, cachePath);
                }
                catch (Exception exception)
                {
                    log("Could not save GitHub theme cache: " + exception.Message);
                }
                log("Downloaded " + downloaded + " GitHub themes.");
            }
        }

        foreach (var theme in cached) themes[theme.Key] = theme.Value;
        return serializer.Serialize(new List<object>(themes.Values));
    }

    private static Dictionary<string, object> ReadThemes(string json, JavaScriptSerializer serializer)
    {
        var items = serializer.DeserializeObject(json) as object[];
        if (items == null) throw new InvalidDataException("Expected a theme array.");
        var themes = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (object item in items)
        {
            var theme = ValidateTheme(item);
            themes[(string)theme["name"]] = theme;
        }
        return themes;
    }

    private static Dictionary<string, object> ValidateTheme(object item)
    {
        var theme = item as Dictionary<string, object>;
        object name;
        object variables;
        if (theme == null || !theme.TryGetValue("name", out name) ||
            !(name is string) || string.IsNullOrWhiteSpace((string)name) ||
            !theme.TryGetValue("vars", out variables) || !(variables is Dictionary<string, object>))
            throw new InvalidDataException("Theme requires a name and a vars object.");
        foreach (var variable in (Dictionary<string, object>)variables)
        {
            if (!variable.Key.StartsWith("--", StringComparison.Ordinal) || !(variable.Value is string))
                throw new InvalidDataException("Theme vars must contain CSS custom properties with string values.");
        }
        return theme;
    }

    private static string SerializeThemes(Dictionary<string, object> themes, JavaScriptSerializer serializer)
    {
        string json = serializer.Serialize(new List<object>(themes.Values));
        if (Encoding.UTF8.GetByteCount(json) > MaxBytes)
            throw new InvalidDataException("Theme cache is too large.");
        return json;
    }
}
