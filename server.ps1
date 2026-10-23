param(
    [int]$Port = 5000,
    [string]$Root = $PSScriptRoot
)

if ([string]::IsNullOrEmpty($Root)) {
    $Root = (Get-Location).Path
}

# Try ports until an open one is found
$listener = New-Object System.Net.HttpListener
$bound = $false
$currentPort = $Port

while (-not $bound -and $currentPort -lt ($Port + 20)) {
    try {
        $listener.Prefixes.Clear()
        $prefix = "http://localhost:$currentPort/"
        $listener.Prefixes.Add($prefix)
        $listener.Start()
        $bound = $true
    } catch {
        Write-Host "Port $currentPort is busy, checking next port..." -ForegroundColor Yellow
        $currentPort++
    }
}

if (-not $bound) {
    Write-Host "Could not find an available port. Please check your firewall or running processes." -ForegroundColor Red
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  NeuroScreen-PD Server Running Successfully!             " -ForegroundColor Green
Write-Host "  URL: $prefix                                            " -ForegroundColor White
Write-Host "  Root: $Root                                             " -ForegroundColor Gray
Write-Host "  Press Ctrl + C in this terminal window to stop.         " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# Automatically open the browser
try {
    Start-Process $prefix
} catch {}

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".csv"  = "text/csv; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($rawPath) -or $rawPath -eq "") {
            $rawPath = "index.html"
        }
        $rawPath = $rawPath.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $Root $rawPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
            $response.ContentType = $contentType
            $bytes = [IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $buf = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $buf.Length
            $response.OutputStream.Write($buf, 0, $buf.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "`nServer stopped." -ForegroundColor Gray
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
