using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Cuterinth
{
    private const int DebugPort = 9222;
    private const int MaxAttempts = 20;
    private const int MaxSavedDataBytes = 5 * 1024 * 1024;
    private const string PersistenceBinding = "cuterinthPersist";

    [STAThread]
    private static void Main()
    {
        bool createdNew;
        using (var instance = new Mutex(true, @"Local\CuterinthLauncher", out createdNew))
        {
            if (!createdNew)
            {
                MessageBox.Show(
                    "Cuterinth is already running in the background.",
                    "Cuterinth",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            while (true)
            {
                try
                {
                    Log("Cuterinth started.");
                    RunAsync().GetAwaiter().GetResult();
                    break;
                }
                catch (Exception exception)
                {
                    Log("Fatal error: " + exception);
                    if (MessageBox.Show(exception.Message + "\n\nAfter resolving the problem, choose Retry to reconnect.",
                        "Cuterinth", MessageBoxButtons.RetryCancel, MessageBoxIcon.Error) == DialogResult.Retry)
                        continue;
                    Environment.ExitCode = 1;
                    break;
                }
            }
        }
    }

    private static async Task RunAsync()
    {
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string modrinthExe = Path.Combine(localAppData, "Modrinth App", "Modrinth App.exe");

        if (!File.Exists(modrinthExe))
        {
            throw new FileNotFoundException(
                "Modrinth App was not found. Install it in the default location first.",
                modrinthExe);
        }

        string savedData = LoadPersistedData();
        string script = ReadEmbeddedScript();
        string bundledThemes = ReadBundledThemes();
        ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
        Task<string> themeRefresh = ThemeCatalog.LoadAsync(
            bundledThemes,
            Path.Combine(Path.GetDirectoryName(GetPersistencePath()), "github-themes.json"),
            Log);
        Log(savedData == null ? "No disk backup found." : "Loaded disk backup.");
        Log("Loaded bundled themes.");
        StartModrinth(modrinthExe);
        Log("Modrinth launch requested.");

        string debuggerUrl = await WaitForDebuggerAsync();
        Log("Found Modrinth debugger target.");
        bundledThemes = await themeRefresh;
        await InjectAndMonitorAsync(debuggerUrl, script, savedData, bundledThemes);
    }

    private static string ReadEmbeddedScript()
    {
        Assembly assembly = Assembly.GetExecutingAssembly();
        using (Stream stream = assembly.GetManifestResourceStream("Cuterinth.default.js"))
        {
            if (stream == null)
            {
                throw new InvalidOperationException("The embedded Cuterinth script is missing from this build.");
            }

            using (var reader = new StreamReader(stream, Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }
    }

    private static string ReadBundledThemes()
    {
        Assembly assembly = Assembly.GetExecutingAssembly();
        var serializer = CreateSerializer();
        var themes = new List<object>();

        string[] resourceNames = assembly.GetManifestResourceNames();
        Array.Sort(resourceNames, StringComparer.OrdinalIgnoreCase);

        foreach (string resourceName in resourceNames)
        {
            if (!resourceName.StartsWith("Cuterinth.themes.", StringComparison.Ordinal) ||
                !resourceName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            using (Stream stream = assembly.GetManifestResourceStream(resourceName))
            using (var reader = new StreamReader(stream, Encoding.UTF8))
            {
                var theme = serializer.DeserializeObject(reader.ReadToEnd()) as Dictionary<string, object>;
                object name;
                object variables;
                if (theme == null ||
                    !theme.TryGetValue("name", out name) ||
                    string.IsNullOrWhiteSpace(Convert.ToString(name)) ||
                    !theme.TryGetValue("vars", out variables) ||
                    !(variables is Dictionary<string, object>))
                {
                    throw new InvalidDataException("Bundled theme " + resourceName + " is invalid.");
                }

                themes.Add(theme);
            }
        }

        if (themes.Count == 0)
        {
            throw new InvalidOperationException("No bundled themes were found inside Cuterinth.exe.");
        }

        return serializer.Serialize(themes.ToArray());
    }

    private static void StartModrinth(string modrinthExe)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = modrinthExe,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(modrinthExe)
        };
        startInfo.EnvironmentVariables["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] =
            "--remote-debugging-port=" + DebugPort;

        Process.Start(startInfo);
    }

    private static string GetPersistencePath()
    {
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "Cuterinth", "themes.json");
    }

    private static void Log(string message)
    {
        try
        {
            string directory = Path.GetDirectoryName(GetPersistencePath());
            Directory.CreateDirectory(directory);
            File.AppendAllText(
                Path.Combine(directory, "Cuterinth.log"),
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + Environment.NewLine,
                new UTF8Encoding(false));
        }
        catch
        {
            // Logging must never prevent the app from starting.
        }
    }

    private static string LoadPersistedData()
    {
        string path = GetPersistencePath();
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            string json = File.ReadAllText(path, Encoding.UTF8);
            ValidatePersistedData(json);
            return json;
        }
        catch
        {
            // A bad or partially written backup must not prevent Cuterinth from starting.
            return null;
        }
    }

    private static void SavePersistedData(string json)
    {
        ValidatePersistedData(json);

        string path = GetPersistencePath();
        string directory = Path.GetDirectoryName(path);
        Directory.CreateDirectory(directory);

        string temporaryPath = path + ".tmp";
        File.WriteAllText(temporaryPath, json, new UTF8Encoding(false));

        if (File.Exists(path))
        {
            File.Replace(temporaryPath, path, null);
        }
        else
        {
            File.Move(temporaryPath, path);
        }

        Log("Saved theme backup.");
    }

    private static void ValidatePersistedData(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || Encoding.UTF8.GetByteCount(json) > MaxSavedDataBytes)
        {
            throw new InvalidDataException("Cuterinth theme data is empty or too large.");
        }

        var serializer = CreateSerializer();
        var data = serializer.DeserializeObject(json) as Dictionary<string, object>;
        object themes;
        if (data == null || !data.TryGetValue("customThemes", out themes) || !(themes is object[]))
        {
            throw new InvalidDataException("Cuterinth theme data has an invalid format.");
        }
    }

    private static JavaScriptSerializer CreateSerializer()
    {
        return new JavaScriptSerializer { MaxJsonLength = MaxSavedDataBytes };
    }

    private static async Task<string> WaitForDebuggerAsync()
    {
        Exception lastError = null;

        for (int attempt = 0; attempt < MaxAttempts; attempt++)
        {
            try
            {
                string json;
                using (var client = new System.Net.Http.HttpClient(new System.Net.Http.HttpClientHandler { UseProxy = false }))
                {
                    client.Timeout = TimeSpan.FromSeconds(2);
                    json = await client.GetStringAsync(
                        "http://127.0.0.1:" + DebugPort + "/json");
                }

                var serializer = CreateSerializer();
                var targets = serializer.DeserializeObject(json) as object[];
                if (targets != null)
                {
                    foreach (object item in targets)
                    {
                        var target = item as Dictionary<string, object>;
                        if (target == null)
                        {
                            continue;
                        }

                        object urlValue;
                        object debuggerValue;
                        if (target.TryGetValue("url", out urlValue) &&
                            target.TryGetValue("webSocketDebuggerUrl", out debuggerValue) &&
                            IsModrinthTarget(target, Convert.ToString(urlValue)))
                        {
                            return Convert.ToString(debuggerValue);
                        }
                    }
                }
            }
            catch (Exception exception)
            {
                lastError = exception;
            }

            await Task.Delay(3000);
        }

        string detail = lastError == null ? string.Empty : "\n\nLast error: " + lastError.Message;
        throw new InvalidOperationException(
            "Cuterinth could not connect to Modrinth. An app update or an already-running copy can start Modrinth without theme support. Close Modrinth completely, then choose Retry." + detail);
    }

    private static bool IsModrinthTarget(Dictionary<string, object> target, string url)
    {
        Uri uri;
        object type;
        return target.TryGetValue("type", out type) && Equals(type, "page") &&
            Uri.TryCreate(url, UriKind.Absolute, out uri) &&
            string.Equals(uri.Host, "tauri.localhost", StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildBootstrap(JavaScriptSerializer serializer, string script, string savedData, string bundledThemes)
    {
        return "globalThis.__cuterinthPersistedData = " + serializer.Serialize(savedData) + ";\n" +
            "globalThis.__cuterinthBundledThemes = " + bundledThemes + ";\n" + script;
    }

    private static async Task InjectAndMonitorAsync(
        string debuggerUrl,
        string script,
        string savedData,
        string bundledThemes)
    {
        using (var socket = new ClientWebSocket())
        {
            Log("Connecting to Modrinth debugger socket.");
            await socket.ConnectAsync(new Uri(debuggerUrl), CancellationToken.None);
            Log("Connected to Modrinth debugger socket.");

            var serializer = CreateSerializer();
            await SendCommandAsync(
                socket,
                serializer,
                1,
                "Runtime.addBinding",
                new Dictionary<string, object> { { "name", PersistenceBinding } });
            Log("Installed persistence binding.");

            string bootstrap = BuildBootstrap(serializer, script, savedData, bundledThemes);

            Dictionary<string, object> message = await SendCommandAsync(
                socket,
                serializer,
                2,
                "Runtime.evaluate",
                new Dictionary<string, object>
                {
                    { "expression", bootstrap },
                    { "awaitPromise", true },
                    { "returnByValue", true }
                });
            Log("Customization script evaluated.");

            if (message.ContainsKey("error"))
                throw new InvalidOperationException("Modrinth could not load Cuterinth: " + serializer.Serialize(message["error"]));

            object resultValue;
            if (message.TryGetValue("result", out resultValue))
            {
                var result = resultValue as Dictionary<string, object>;
                if (result != null && result.ContainsKey("exceptionDetails"))
                {
                    string details = serializer.Serialize(result["exceptionDetails"]);
                    Log("Script exception: " + details);
                    throw new InvalidOperationException(
                        "Modrinth rejected the embedded customization script. Details were written to " +
                        Path.Combine(Path.GetDirectoryName(GetPersistencePath()), "Cuterinth.log") + ".");
                }
            }

            await MonitorPersistenceAsync(socket, serializer, script, savedData, bundledThemes);
        }
    }

    private static async Task<Dictionary<string, object>> SendCommandAsync(
        ClientWebSocket socket,
        JavaScriptSerializer serializer,
        int id,
        string method,
        Dictionary<string, object> parameters)
    {
        string request = serializer.Serialize(new Dictionary<string, object>
        {
            { "id", id },
            { "method", method },
            { "params", parameters }
        });

        byte[] requestBytes = Encoding.UTF8.GetBytes(request);
        await socket.SendAsync(
            new ArraySegment<byte>(requestBytes),
            WebSocketMessageType.Text,
            true,
            CancellationToken.None);

        while (true)
        {
            string response = await ReceiveMessageAsync(socket);
            if (response == null)
            {
                throw new InvalidOperationException("Modrinth closed before Cuterinth finished loading.");
            }

            var message = serializer.DeserializeObject(response) as Dictionary<string, object>;
            ProcessPersistenceMessage(message);

            object idValue;
            if (message != null &&
                message.TryGetValue("id", out idValue) &&
                Convert.ToInt32(idValue) == id)
            {
                return message;
            }
        }
    }

    private static async Task MonitorPersistenceAsync(
        ClientWebSocket socket,
        JavaScriptSerializer serializer,
        string script,
        string savedData,
        string bundledThemes)
    {
        int commandId = 3;
        string lastSavedData = savedData;

        try
        {
            while (socket.State == WebSocketState.Open)
            {
                // Full page reloads discard injected code. Restore it using the latest selection,
                // while keeping normal polling small and leaving Vue's navigation alone.
                Dictionary<string, object> message = await SendCommandAsync(
                    socket,
                    serializer,
                    commandId++,
                    "Runtime.evaluate",
                    new Dictionary<string, object>
                    {
                        { "expression", "JSON.stringify({data:localStorage.getItem('modded'),ready:document.readyState !== 'loading',active:!!globalThis.__cuterinthVersion})" },
                        { "returnByValue", true }
                    });

                string stateJson = GetEvaluationString(message);
                if (stateJson == null) { await Task.Delay(2000); continue; }
                var state = serializer.DeserializeObject(stateJson) as Dictionary<string, object>;
                string currentData = state == null ? null : Convert.ToString(state["data"]);
                if (state != null && Equals(state["ready"], true) && Equals(state["active"], false))
                {
                    string backup = string.IsNullOrWhiteSpace(currentData) ? lastSavedData : currentData;
                    var restored = await SendCommandAsync(socket, serializer, commandId++, "Runtime.evaluate",
                        new Dictionary<string, object> {
                            { "expression", BuildBootstrap(serializer, script, backup, bundledThemes) },
                            { "returnByValue", true }, { "awaitPromise", true }
                        });
                    object restoreResult;
                    var evaluation = restored.TryGetValue("result", out restoreResult) ? restoreResult as Dictionary<string, object> : null;
                    if (restored.ContainsKey("error") || (evaluation != null && evaluation.ContainsKey("exceptionDetails")))
                        Log("Reload recovery failed: " + serializer.Serialize(restored));
                    else Log("Restored customization after page reload.");
                }
                if (!string.IsNullOrWhiteSpace(currentData) &&
                    !string.Equals(currentData, lastSavedData, StringComparison.Ordinal))
                {
                    SavePersistedData(currentData);
                    lastSavedData = currentData;
                }

                await Task.Delay(2000);
            }
        }
        catch (WebSocketException)
        {
            // Closing Modrinth normally closes the debugging socket too.
        }
        catch (InvalidOperationException)
        {
            if (socket.State == WebSocketState.Open)
            {
                throw;
            }
        }
    }

    private static string GetEvaluationString(Dictionary<string, object> message)
    {
        object commandResultValue;
        var commandResult = message != null && message.TryGetValue("result", out commandResultValue)
            ? commandResultValue as Dictionary<string, object>
            : null;

        object remoteObjectValue;
        var remoteObject = commandResult != null && commandResult.TryGetValue("result", out remoteObjectValue)
            ? remoteObjectValue as Dictionary<string, object>
            : null;

        object value;
        return remoteObject != null && remoteObject.TryGetValue("value", out value)
            ? Convert.ToString(value)
            : null;
    }

    private static void ProcessPersistenceMessage(Dictionary<string, object> message)
    {
        if (message == null)
        {
            return;
        }

        object methodValue;
        if (!message.TryGetValue("method", out methodValue) ||
            !string.Equals(Convert.ToString(methodValue), "Runtime.bindingCalled", StringComparison.Ordinal))
        {
            return;
        }

        object parametersValue;
        var parameters = message.TryGetValue("params", out parametersValue)
            ? parametersValue as Dictionary<string, object>
            : null;
        if (parameters == null)
        {
            return;
        }

        object nameValue;
        object payloadValue;
        if (parameters.TryGetValue("name", out nameValue) &&
            parameters.TryGetValue("payload", out payloadValue) &&
            string.Equals(Convert.ToString(nameValue), PersistenceBinding, StringComparison.Ordinal))
        {
            SavePersistedData(Convert.ToString(payloadValue));
        }
    }

    private static async Task<string> ReceiveMessageAsync(ClientWebSocket socket)
    {
        var buffer = new byte[8192];
        using (var stream = new MemoryStream())
        {
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    return null;
                }

                stream.Write(buffer, 0, result.Count);
            }
            while (!result.EndOfMessage);

            return Encoding.UTF8.GetString(stream.ToArray());
        }
    }
}
