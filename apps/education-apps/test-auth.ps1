
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@injahi.com","password":"admin123"}'
Write-Host "Login Response: $($loginResponse | ConvertTo-Json -Depth 10)"

if ($loginResponse.success) {
    $token = $loginResponse.data.token
    Write-Host "Token: $token"
    
    try {
        $meResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/me" -Method Get -Headers @{ "Authorization" = "Bearer $token" }
        Write-Host "Me Response: $($meResponse | ConvertTo-Json -Depth 10)"
    } catch {
        Write-Host "Me Request Failed: $_"
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Body: $($reader.ReadToEnd())"
    }
} else {
    Write-Host "Login Failed"
}
