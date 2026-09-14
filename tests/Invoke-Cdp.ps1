param(
    [string]$Expression,
    [string]$ScriptPath,
    [string]$Method = 'Runtime.evaluate',
    [hashtable]$Parameters
)
$ErrorActionPreference = 'Stop'
if ($ScriptPath) { $Expression = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ScriptPath)) }
if (-not $Parameters) { $Parameters = @{ expression=$Expression; returnByValue=$true; awaitPromise=$true } }
$targets = Invoke-RestMethod http://127.0.0.1:9222/json -TimeoutSec 3
$target = @($targets | ForEach-Object { $_ } | Where-Object { $_.type -eq 'page' -and ([Uri]$_.url).Host -eq 'tauri.localhost' })[0]
if (-not $target) { throw 'No Modrinth debugger page found.' }
$socket = New-Object System.Net.WebSockets.ClientWebSocket
$deadline = New-Object System.Threading.CancellationTokenSource
$deadline.CancelAfter(15000)
try {
    $null = $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, $deadline.Token).GetAwaiter().GetResult()
    $request = @{ id=101; method=$Method; params=$Parameters } | ConvertTo-Json -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($request)
    $null = $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $deadline.Token).GetAwaiter().GetResult()
    do {
        $buffer = New-Object byte[] 65536
        $stream = New-Object IO.MemoryStream
        try {
            do {
                $result = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $deadline.Token).GetAwaiter().GetResult()
                if ($result.MessageType -eq 'Close') { throw 'Modrinth closed the connection.' }
                $stream.Write($buffer, 0, $result.Count)
            } while (-not $result.EndOfMessage)
            $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
        } finally { $stream.Dispose() }
    } while ($message.id -ne 101)
    if ($message.error) { throw ($message.error | ConvertTo-Json -Compress) }
    if ($message.result.exceptionDetails) {
        $details = $message.result.exceptionDetails | ConvertTo-Json -Depth 10 -Compress
        throw $details.Substring(0, [Math]::Min(3000, $details.Length))
    }
    $message.result | ConvertTo-Json -Depth 20
} finally { $socket.Dispose(); $deadline.Dispose() }
