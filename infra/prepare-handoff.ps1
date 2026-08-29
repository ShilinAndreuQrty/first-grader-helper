[CmdletBinding()]
param(
    [string]$OutputDirectory = "handoff"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $root ".env"
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Не найден $envFile. Создайте .env из .env.example и повторите попытку."
}

$date = Get-Date -Format "yyyyMMdd"
$stage = Join-Path $root "$OutputDirectory\\ipmkn-start-handoff-$date"
$archive = "$stage.zip"

if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
}

New-Item -ItemType Directory -Path "$stage\\secrets", "$stage\\config", "$stage\\data", "$stage\\seeds" -Force | Out-Null

Copy-Item -LiteralPath $envFile -Destination "$stage\\secrets\\.env.current"
Copy-Item -LiteralPath (Join-Path $root ".env.example") -Destination "$stage\\secrets\\.env.production.example"
Copy-Item -LiteralPath (Join-Path $root "docker-compose.prod.yml") -Destination "$stage\\config\\docker-compose.prod.yml"
Copy-Item -LiteralPath (Join-Path $root "infra\\Caddyfile") -Destination "$stage\\config\\Caddyfile"
Copy-Item -LiteralPath (Join-Path $root "infra\\backup.sh") -Destination "$stage\\config\\backup.sh"
Copy-Item -LiteralPath (Join-Path $root "infra\\restore.sh") -Destination "$stage\\config\\restore.sh"
Copy-Item -LiteralPath (Join-Path $root "backend\\app\\knowledge\\seed\\faq.json") -Destination "$stage\\seeds\\faq.json"
Copy-Item -LiteralPath (Join-Path $root "backend\\examples\\tutors.csv") -Destination "$stage\\seeds\\tutors.csv"
Copy-Item -LiteralPath (Join-Path $root "Baza_voprosov_itog.docx") -Destination "$stage\\seeds\\Baza_voprosov_itog.docx"
Copy-Item -LiteralPath (Join-Path $root "docs\\deployment-handoff.md") -Destination "$stage\\README.md"

$sqliteSnapshot = Join-Path $root "backend\\ipmkn.sqlite3"
if (Test-Path -LiteralPath $sqliteSnapshot) {
    Copy-Item -LiteralPath $sqliteSnapshot -Destination "$stage\\data\\ipmkn-local-snapshot.sqlite3"
}

$manifest = @"
# Contents

- `secrets/.env.current`: current environment file; contains secrets.
- `secrets/.env.production.example`: production template; fill or replace secrets.
- `config/`: Docker Compose, Caddy and database backup/restore scripts.
- `seeds/`: repeatable initial data. Run `python -m app.seed` after migrations.
- `data/ipmkn-local-snapshot.sqlite3`: optional local snapshot, not a PostgreSQL dump.

Do not commit this archive or unpacked directory to Git.
"@
Set-Content -LiteralPath "$stage\\CONTENTS.md" -Value $manifest -Encoding utf8

Compress-Archive -LiteralPath $stage -DestinationPath $archive -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
Set-Content -LiteralPath "$archive.sha256" -Value "$hash  $(Split-Path -Leaf $archive)" -Encoding ascii

Write-Output "Создано: $archive"
Write-Output "SHA256: $hash"
