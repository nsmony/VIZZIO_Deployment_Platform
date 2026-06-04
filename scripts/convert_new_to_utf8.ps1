$files = Get-ChildItem -Path '.\frontend\src\pages\admin' -Filter '*.new' -ErrorAction SilentlyContinue
foreach ($f in $files) {
  $t = $f.FullName -replace '\.new$',''
  try {
    (Get-Content -Path $f.FullName -Encoding Unicode -Raw) | Set-Content -Path $t -Encoding UTF8
    Write-Host "WROTE: $t"
  } catch {
    Write-Host "FAILED WRITE: $t -> $($_.Exception.Message)"
  }
}
Get-ChildItem .\frontend\src\pages\admin -Name | Write-Host
