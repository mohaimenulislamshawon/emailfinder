# Start server in background
Write-Host "Starting server..." -ForegroundColor Cyan
$serverProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru
Write-Host "Server PID: $($serverProcess.Id)"

# Wait for server to initialize
Start-Sleep -Seconds 3

Write-Host "`n=== TEST 1: Submit URL ===" -ForegroundColor Green
$body = ConvertTo-Json @{url="example.com"}
$response = Invoke-WebRequest -Uri "http://localhost:3000/submit" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing
Write-Host "Response:"
Write-Host $response.Content

Write-Host "`n=== TEST 2: Wait for processing (should see worker logs) ===" -ForegroundColor Green
Write-Host "Waiting 8 seconds for crawler to process..."
Start-Sleep -Seconds 8

Write-Host "`n=== TEST 3: Check Results ===" -ForegroundColor Green
$results = Invoke-WebRequest -Uri "http://localhost:3000/results" `
    -Method GET `
    -UseBasicParsing | ConvertFrom-Json

Write-Host "Results received: $($results.Count) items"
if ($results -and $results.Count -gt 0) {
    Write-Host "First result:" -ForegroundColor Yellow
    $results[0] | ConvertTo-Json
} else {
    Write-Host "NO RESULTS FOUND!" -ForegroundColor Red
}

Write-Host "`n=== Checking results.json file ===" -ForegroundColor Green
if (Test-Path "results.json") {
    $fileSize = (Get-Item "results.json").Length
    Write-Host "results.json exists: $fileSize bytes"
    $content = Get-Content "results.json" -First 3
    Write-Host "First 3 lines:"
    $content | ForEach-Object { Write-Host $_  }
} else {
    Write-Host "results.json does not exist!" -ForegroundColor Red
}

Write-Host "`n=== Cleanup ===" -ForegroundColor Green
Write-Host "Stopping server (PID: $($serverProcess.Id))..."
Stop-Process -Id $serverProcess.Id -Force
Start-Sleep -Seconds 1
Write-Host "Done!"
