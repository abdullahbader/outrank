# Local dev database for Outrank (user-owned PostgreSQL 18 cluster on port 5436, no Windows service).
# Usage:  .\scripts\db.ps1 start | stop | status
param([ValidateSet('start','stop','status')][string]$Action = 'status')

$bin  = 'C:\Program Files\PostgreSQL\18\bin'
$data = 'C:\Users\DP\pgdata\outrank'
$log  = 'C:\Users\DP\pgdata\outrank.log'

switch ($Action) {
  'start' {
    # Start-Process detaches the server so this shell does not hang.
    Start-Process -FilePath "$bin\pg_ctl.exe" -NoNewWindow -Wait:$false `
      -ArgumentList @('-D', "`"$data`"", '-o', '"-p 5436 -c listen_addresses=127.0.0.1"', '-l', "`"$log`"", 'start')
    Start-Sleep -Seconds 2
    & "$bin\pg_ctl.exe" -D $data status
  }
  'stop'   { & "$bin\pg_ctl.exe" -D $data stop -m fast }
  'status' { & "$bin\pg_ctl.exe" -D $data status }
}
