// PowerShell 5.1 compatible scripts. Locale-independent WMI formatted-data classes
// are used (English property names on every Windows language).

const HEADER = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "$ProgressPreference = 'SilentlyContinue'",
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8"
].join('\n')

/**
 * Fast sampler (1s loop): memory perf counters, physical disk activity,
 * network interface throughput, GPU engine utilization, logical disk
 * capacity (every 15s) and battery (every 30s). Emits one NDJSON line per loop.
 */
export const FAST_SAMPLER_SCRIPT = `
${HEADER}
$i = 0
while ($true) {
  $o = [ordered]@{}
  $o['ts'] = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $mem = $null
  try {
    $m = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory -ErrorAction Stop
    $mem = [ordered]@{
      available = [uint64]$m.AvailableBytes
      committed = [uint64]$m.CommittedBytes
      limit = [uint64]$m.CommitLimit
      cache = [uint64]$m.CacheBytes
      poolPaged = [uint64]$m.PoolPagedBytes
      poolNonPaged = [uint64]$m.PoolNonPagedBytes
    }
  } catch {}
  $o['mem'] = $mem
  $disks = @()
  try {
    Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction Stop |
      Where-Object { $_.Name -ne '_Total' } |
      ForEach-Object {
        $disks += [ordered]@{
          device = [string]$_.Name
          read = [uint64]$_.DiskReadBytesPerSec
          write = [uint64]$_.DiskWriteBytesPerSec
          idle = [double]$_.PercentIdleTime
          queue = [double]$_.CurrentDiskQueueLength
        }
      }
  } catch {}
  $o['disks'] = $disks
  $nets = @()
  try {
    Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction Stop |
      Where-Object { $_.Name -notmatch '(?i)loopback|isatap|teredo|bluetooth' } |
      ForEach-Object {
        $nets += [ordered]@{
          id = [string]$_.Name
          sent = [uint64]$_.BytesSentPerSec
          recv = [uint64]$_.BytesReceivedPerSec
          bw = [uint64]$_.CurrentBandwidth
        }
      }
  } catch {}
  $o['net'] = $nets
  $gpus = @()
  try {
    $eng = Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop
    $am = Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory -ErrorAction SilentlyContinue
    $byPhys = @{}
    foreach ($e in $eng) {
      if ($e.Name -match 'phys_(\\d+)') {
        $p = $Matches[1]
        $cur = 0.0
        if ($byPhys.ContainsKey($p)) { $cur = $byPhys[$p] }
        $byPhys[$p] = $cur + [double]$e.UtilizationPercentage
      }
    }
    foreach ($k in $byPhys.Keys) {
      $ded = $null
      $sh = $null
      if ($am) {
        $adapter = $am | Where-Object { $_.Name -match ('phys_' + $k + '$') } | Select-Object -First 1
        if ($adapter) {
          $ded = [uint64]$adapter.DedicatedUsage
          $sh = [uint64]$adapter.SharedUsage
        }
      }
      $util = [Math]::Min(100.0, [Math]::Round($byPhys[$k], 1))
      $gpus += [ordered]@{ id = [string]$k; util = $util; dedicated = $ded; shared = $sh }
    }
  } catch {}
  $o['gpu'] = $gpus
  if ($i % 15 -eq 0) {
    $lv = @()
    try {
      Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop |
        ForEach-Object {
          $lv += [ordered]@{
            volume = [string]$_.DeviceID
            label = [string]$_.VolumeName
            total = [uint64]$_.Size
            free = [uint64]$_.FreeSpace
          }
        }
    } catch {}
    $o['logical'] = $lv
  }
  if ($i % 30 -eq 0) {
    $batt = $null
    $b = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($b) {
      $batt = [ordered]@{ pct = [int]$b.EstimatedChargeRemaining; charging = ($b.BatteryStatus -eq 2) }
    }
    $o['battery'] = $batt
  }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 6))
  [Console]::Out.Flush()
  $i = $i + 1
  Start-Sleep -Milliseconds 1000
}
`

/**
 * Process sampler (2s loop): lightweight per-process snapshot via Get-Process.
 * CPU deltas are computed in the main process.
 */
export const PROC_SAMPLER_SCRIPT = `
${HEADER}
while ($true) {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $ps = @()
  foreach ($p in (Get-Process -ErrorAction SilentlyContinue)) {
    $st = $null
    try { $st = [DateTimeOffset]::new($p.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds() } catch {}
    $cpu = -1.0
    try { if ($null -ne $p.CPU) { $cpu = [double]$p.CPU } } catch {}
    $ps += [ordered]@{
      pid = [int]$p.Id
      name = [string]$p.ProcessName
      cpu = $cpu
      ws = [uint64]$p.WorkingSet64
      pm = [uint64]$p.PrivateMemorySize64
      started = $st
    }
  }
  [Console]::Out.WriteLine(([ordered]@{ ts = $ts; procs = $ps } | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 2000
}
`

/**
 * Metadata sampler (15s loop): Win32_Process for PPID, path, command line,
 * thread/handle counts and creation time.
 */
export const META_SAMPLER_SCRIPT = `
${HEADER}
while ($true) {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $list = @()
  try {
    foreach ($p in (Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)) {
      $st = $null
      try {
        if ($null -ne $p.CreationDate) { $st = [DateTimeOffset]::new($p.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds() }
      } catch {}
      $list += [ordered]@{
        pid = [int]$p.ProcessId
        ppid = [int]$p.ParentProcessId
        path = [string]$p.ExecutablePath
        cmd = [string]$p.CommandLine
        threads = [int]$p.ThreadCount
        handles = [uint64]$p.HandleCount
        started = $st
      }
    }
  } catch {}
  [Console]::Out.WriteLine(([ordered]@{ ts = $ts; meta = $list } | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 15000
}
`

export function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/** Static system information, emitted as one compressed JSON line. */
export const STATIC_INFO_SCRIPT = `
${HEADER}
$out = [ordered]@{}
$out['isElevated'] = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$os = $null
try {
  $o1 = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
  $inst = $null
  try { if ($o1.InstallDate) { $inst = [DateTimeOffset]::new($o1.InstallDate.ToUniversalTime()).ToUnixTimeMilliseconds() } } catch {}
  $boot = $null
  try { if ($o1.LastBootUpTime) { $boot = [DateTimeOffset]::new($o1.LastBootUpTime.ToUniversalTime()).ToUnixTimeMilliseconds() } } catch {}
  $os = [ordered]@{
    caption = [string]$o1.Caption
    version = [string]$o1.Version
    build = [string]$o1.BuildNumber
    arch = [string]$o1.OSArchitecture
    installDate = $inst
    lastBoot = $boot
    locale = [string](Get-Culture).Name
    hostname = [string]$env:COMPUTERNAME
  }
} catch {}
$out['os'] = $os
$cs = $null
$pcType = $null
try {
  $c1 = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop
  $t = [int]$c1.PCSystemType
  if ($t -eq 1) { $pcType = 'Desktop' } elseif ($t -eq 2) { $pcType = 'Laptop' } elseif ($t -eq 3) { $pcType = 'Workstation' } else { $pcType = 'PC' }
  $cs = [ordered]@{
    manufacturer = [string]$c1.Manufacturer
    model = [string]$c1.Model
    pcType = $pcType
    totalMem = [uint64]$c1.TotalPhysicalMemory
  }
} catch {}
$out['computer'] = $cs
$cpu = $null
try {
  $c = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1
  $cpu = [ordered]@{
    name = [string]$c.Name
    manufacturer = [string]$c.Manufacturer
    cores = [int]$c.NumberOfCores
    logical = [int]$c.NumberOfLogicalProcessors
    baseClockMhz = [uint32]$c.MaxClockSpeed
    maxClockMhz = [uint32]$c.MaxClockSpeed
    l2MB = if ($null -ne $c.L2CacheSize) { [uint32]$c.L2CacheSize / 1024 } else { $null }
    l3MB = if ($null -ne $c.L3CacheSize) { [uint32]$c.L3CacheSize / 1024 } else { $null }
  }
} catch {}
$out['cpu'] = $cpu
$mods = @()
try {
  Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction Stop | ForEach-Object {
    $mods += [ordered]@{
      slot = [string]$_.DeviceLocator
      capacity = [uint64]$_.Capacity
      speed = if ($null -ne $_.Speed) { [uint32]$_.Speed } else { $null }
      configuredSpeed = if ($null -ne $_.ConfiguredClockSpeed) { [uint32]$_.ConfiguredClockSpeed } else { $null }
      manufacturer = [string]$_.Manufacturer
      partNumber = [string]$_.PartNumber
    }
  }
} catch {}
$out['ramModules'] = $mods
$board = $null
try {
  $b = Get-CimInstance -ClassName Win32_BaseBoard -ErrorAction Stop | Select-Object -First 1
  $board = [ordered]@{ manufacturer = [string]$b.Manufacturer; product = [string]$b.Product; version = [string]$b.Version }
} catch {}
$out['motherboard'] = $board
$bios = $null
try {
  $b2 = Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop | Select-Object -First 1
  $bdate = $null
  try { if ($b2.ReleaseDate) { $bdate = [DateTimeOffset]::new($b2.ReleaseDate.ToUniversalTime()).ToUnixTimeMilliseconds() } } catch {}
  $bios = [ordered]@{ vendor = [string]$b2.Manufacturer; version = [string]$b2.SMBIOSBIOSVersion; releaseDate = $bdate }
} catch {}
$out['bios'] = $bios
$gpus = @()
try {
  $vramMap = @{}
  try {
    Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction Stop |
      Where-Object { $_.PSChildName -match '^\\d{4}$' } |
      ForEach-Object {
        $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if ($p -and $p.DriverDesc) {
          $sz = $null
          try { if ($p.'HardwareInformation.qwMemorySize') { $sz = [uint64]$p.'HardwareInformation.qwMemorySize' } } catch {}
          try { if (-not $sz -and $p.'HardwareInformation.MemorySize') { $sz = [uint64]$p.'HardwareInformation.MemorySize' } } catch {}
          $vramMap[$p.DriverDesc] = $sz
        }
      }
  } catch {}
  Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop | ForEach-Object {
    $vr = $null
    if ($vramMap.ContainsKey([string]$_.Name)) { $vr = $vramMap[[string]$_.Name] }
    if (-not $vr) { try { if ($_.AdapterRAM) { $vr = [uint64]$_.AdapterRAM } } catch {} }
    $dd = $null
    try { if ($_.DriverDate) { $dd = [DateTimeOffset]::new($_.DriverDate.ToUniversalTime()).ToUnixTimeMilliseconds() } } catch {}
    $gpus += [ordered]@{
      name = [string]$_.Name
      driverVersion = [string]$_.DriverVersion
      driverDate = $dd
      vram = $vr
      videoMode = [string]$_.VideoModeDescription
      status = [string]$_.Status
      pnpId = [string]$_.PNPDeviceID
    }
  }
} catch {}
$out['gpus'] = $gpus
$storage = @()
try {
  $pd = Get-PhysicalDisk -ErrorAction Stop
  foreach ($d in $pd) {
    $storage += [ordered]@{
      model = [string]$d.FriendlyName
      size = [uint64]$d.Size
      busType = [string]$d.BusType
      mediaType = [string]$d.MediaType
      health = [string]$d.HealthStatus
      firmware = [string]$d.FirmwareVersion
    }
  }
} catch {}
if ($storage.Count -eq 0) {
  try {
    Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction Stop | ForEach-Object {
      $storage += [ordered]@{
        model = [string]$_.Model
        size = [uint64]$_.Size
        busType = [string]$_.InterfaceType
        mediaType = [string]$_.MediaType
        health = $null
        firmware = [string]$_.FirmwareRevision
      }
    }
  } catch {}
}
$out['storage'] = $storage
$adapters = @()
try {
  $na = Get-NetAdapter -ErrorAction Stop
  foreach ($a in $na) {
    $adapters += [ordered]@{
      name = [string]$a.Name
      description = [string]$a.InterfaceDescription
      mac = [string]$a.MacAddress
      status = [string]$a.Status
      linkSpeed = [string]$a.LinkSpeed
    }
  }
} catch {}
if ($adapters.Count -eq 0) {
  try {
    Get-CimInstance -ClassName Win32_NetworkAdapter -Filter 'PhysicalAdapter=True' -ErrorAction Stop | ForEach-Object {
      $adapters += [ordered]@{
        name = [string]$_.NetConnectionID
        description = [string]$_.Name
        mac = [string]$_.MACAddress
        status = if ([bool]$_.NetEnabled) { 'Up' } else { 'Disabled' }
        linkSpeed = $null
      }
    }
  } catch {}
}
$out['adapters'] = $adapters
[Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 8))
`

/** One-shot file information: Authenticode signature + version info. Expects $path variable pre-set. */
export function fileInfoScript(psPath: string): string {
  return `
${HEADER}
$p = ${psPath}
$out = [ordered]@{}
$sig = $null
try {
  $s = Get-AuthenticodeSignature -FilePath $p -ErrorAction Stop
  $signer = $null
  if ($s.SignerCertificate) { $signer = [string]$s.SignerCertificate.Subject }
  $sig = [ordered]@{ status = [string]$s.Status; signer = $signer }
} catch {}
$out['signature'] = $sig
$ver = $null
try {
  $it = Get-Item -LiteralPath $p -ErrorAction Stop
  $v = $it.VersionInfo
  $mtime = $null
  try { $mtime = [DateTimeOffset]::new($it.LastWriteTimeUtc.ToUniversalTime()).ToUnixTimeMilliseconds() } catch {}
  $ver = [ordered]@{
    company = [string]$v.CompanyName
    description = [string]$v.FileDescription
    fileVersion = [string]$v.FileVersion
    productName = [string]$v.ProductName
    size = [uint64]$it.Length
    modified = $mtime
  }
} catch {}
$out['fileInfo'] = $ver
[Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 4))
`
}

/** Kills a process by pid. Returns OK or ERR:<message> */
export function killScript(pid: number, force: boolean): string {
  const f = force ? ' -Force' : ''
  return `
${HEADER}
try { Stop-Process -Id ${pid}${f} -ErrorAction Stop; Write-Output 'OK' } catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

/** Sets process priority class. */
export function priorityScript(pid: number, priority: string): string {
  return `
${HEADER}
try { $p = Get-Process -Id ${pid} -ErrorAction Stop; $p.PriorityClass = '${priority}'; Write-Output 'OK' } catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

// ── Process enrichment: tasklist /v (user name, responsiveness) ──

export const TASKLIST_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
$oemcp = 850
try { $oemcp = [int](Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage').OEMCP } catch {}
try { [Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding($oemcp) } catch {}
$rows = @(tasklist /fo csv /v /nh 2>$null)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ rows = $rows })))
`

// ── Network connections (CIM with netstat fallback) ──────────────

export const NETWORK_SCRIPT = `
${HEADER}
$src = 'cim'
$tcp = @()
try {
  $tcp = @(Get-NetTCPConnection -ErrorAction Stop | ForEach-Object {
    [pscustomobject]@{ la = [string]$_.LocalAddress; lp = [int]$_.LocalPort; ra = [string]$_.RemoteAddress; rp = [int]$_.RemotePort; st = [string]$_.State; pid = [int]$_.OwningProcess }
  })
} catch { $tcp = @() }
if ($tcp.Count -eq 0) {
  $src = 'netstat'
  $tcp = @(netstat -ano -p tcp 2>$null | ForEach-Object {
    $t = ($_.Trim() -split '\\s+')
    if ($t.Count -ge 5 -and $t[0] -eq 'TCP') {
      $li = $t[1].LastIndexOf(':')
      $ri = $t[2].LastIndexOf(':')
      if ($li -gt 0 -and $ri -gt 0) {
        [pscustomobject]@{ la = $t[1].Substring(0, $li); lp = [int]$t[1].Substring($li + 1); ra = $t[2].Substring(0, $ri); rp = [int]$t[2].Substring($ri + 1); st = $t[3]; pid = [int]$t[4] }
      }
    }
  })
}
$udp = @()
try {
  $udp = @(Get-NetUDPEndpoint -ErrorAction Stop | ForEach-Object {
    [pscustomobject]@{ la = [string]$_.LocalAddress; lp = [int]$_.LocalPort; pid = [int]$_.OwningProcess }
  })
} catch { $udp = @() }
if ($udp.Count -eq 0) {
  $udp = @(netstat -ano -p udp 2>$null | ForEach-Object {
    $t = ($_.Trim() -split '\\s+')
    if ($t.Count -ge 4 -and $t[0] -eq 'UDP') {
      $li = $t[1].LastIndexOf(':')
      if ($li -gt 0) {
        [pscustomobject]@{ la = $t[1].Substring(0, $li); lp = [int]$t[1].Substring($li + 1); pid = [int]$t[3] }
      }
    }
  })
}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ src = $src; tcp = $tcp; udp = $udp }) -Depth 4))
`

// ── Services ─────────────────────────────────────────────────────

export const SERVICES_SCRIPT = `
${HEADER}
$svcs = @()
try {
  $svcs = @(Get-CimInstance -ClassName Win32_Service -ErrorAction Stop | ForEach-Object {
    [pscustomobject]@{
      name = [string]$_.Name
      display = [string]$_.DisplayName
      state = [string]$_.State
      mode = [string]$_.StartMode
      delayed = [bool]$_.DelayedAutoStart
      account = [string]$_.StartName
      pid = [int]$_.ProcessId
      desc = [string]$_.Description
      path = [string]$_.PathName
      acceptStop = [bool]$_.AcceptStop
      acceptPause = [bool]$_.AcceptPause
    }
  })
} catch {}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ services = $svcs }) -Depth 4))
`

export function serviceActionScript(name: string, action: 'start' | 'stop' | 'restart'): string {
  const cmd =
    action === 'start'
      ? `Start-Service -Name ${psQuote(name)} -ErrorAction Stop`
      : action === 'stop'
        ? `Stop-Service -Name ${psQuote(name)} -ErrorAction Stop`
        : `Restart-Service -Name ${psQuote(name)} -ErrorAction Stop`
  return `
${HEADER}
try { ${cmd}; Write-Output 'OK' } catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

export function serviceStartupScript(name: string, mode: string): string {
  return `
${HEADER}
try { Set-Service -Name ${psQuote(name)} -StartupType ${mode} -ErrorAction Stop; Write-Output 'OK' } catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

// ── Startup items ────────────────────────────────────────────────

export const STARTUP_LIST_SCRIPT = `
${HEADER}
function Read-Approved([string]$path) {
  $map = @{}
  try {
    $k = Get-Item -LiteralPath $path -ErrorAction Stop
    foreach ($n in $k.Property) {
      $v = $k.GetValue($n)
      $en = $true
      if ($v -is [byte[]] -and $v.Length -gt 0) { $en = (($v[0] -band 1) -eq 0) }
      $map[$n] = $en
    }
  } catch {}
  return $map
}
$items = @()
$defs = @(
  @{ target = 'HKLM'; sub = 'Run'; key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; approved = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'; label = 'HKLM ... Run'; tog = $true },
  @{ target = 'HKLM'; sub = 'RunOnce'; key = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; approved = ''; label = 'HKLM ... RunOnce'; tog = $false },
  @{ target = 'HKCU'; sub = 'Run'; key = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; approved = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'; label = 'HKCU ... Run'; tog = $true },
  @{ target = 'HKCU'; sub = 'RunOnce'; key = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; approved = ''; label = 'HKCU ... RunOnce'; tog = $false }
)
foreach ($d in $defs) {
  try { $k = Get-Item -LiteralPath $d.key -ErrorAction Stop } catch { continue }
  $approved = @{}
  if ($d.tog) { $approved = Read-Approved $d.approved }
  foreach ($n in $k.Property) {
    try {
      $val = $k.GetValue($n)
      $en = $true
      if ($approved.ContainsKey($n)) { $en = $approved[$n] }
      $items += [pscustomobject]@{ kind = 'registry'; target = $d.target; sub = $d.sub; name = [string]$n; command = [string]$val; location = $d.label; enabled = $en; toggleable = $d.tog }
    } catch {}
  }
}
$folderDefs = @(
  @{ target = 'HKCU'; dir = [Environment]::GetFolderPath('Startup'); approved = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'; label = 'Kullanici baslangic klasoru' },
  @{ target = 'HKLM'; dir = [Environment]::GetFolderPath('CommonStartup'); approved = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'; label = 'Ortak baslangic klasoru' }
)
foreach ($f in $folderDefs) {
  if (-not $f.dir -or -not (Test-Path -LiteralPath $f.dir)) { continue }
  $approved = Read-Approved $f.approved
  try {
    foreach ($file in (Get-ChildItem -LiteralPath $f.dir -File -ErrorAction Stop)) {
      $en = $true
      if ($approved.ContainsKey($file.Name)) { $en = $approved[$file.Name] }
      $items += [pscustomobject]@{ kind = 'folder'; target = $f.target; sub = 'StartupFolder'; name = [string]$file.Name; command = [string]$file.FullName; location = $f.label; enabled = $en; toggleable = $true }
    }
  } catch {}
}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ items = @($items) }) -Depth 4))
`

export function startupToggleScript(target: string, sub: string, name: string, enable: boolean): string {
  const enableStr = enable ? '$true' : '$false'
  return `
${HEADER}
$target = '${target}'
$sub = '${sub}'
$name = ${psQuote(name)}
$enable = ${enableStr}
$root = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'
if ($target -eq 'HKLM') { $root = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved' }
$approvedKey = $root + '\\' + $sub
try {
  if ($enable) {
    Remove-ItemProperty -Path $approvedKey -Name $name -ErrorAction Stop
  } else {
    if (-not (Test-Path -LiteralPath $approvedKey)) { New-Item -Path $approvedKey -Force -ErrorAction Stop | Out-Null }
    New-ItemProperty -Path $approvedKey -Name $name -Value ([byte[]](3,0,0,0,0,0,0,0,0,0,0,0)) -PropertyType Binary -Force -ErrorAction Stop | Out-Null
  }
  Write-Output 'OK'
} catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

// ── Installed apps ───────────────────────────────────────────────

export const APPS_SCRIPT = `
${HEADER}
$items = @()
$paths = @(
  @{ root = 'HKLM'; p = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' },
  @{ root = 'HKLM32'; p = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' },
  @{ root = 'HKCU'; p = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\' }
)
foreach ($h in $paths) {
  try { $keys = Get-ChildItem -LiteralPath $h.p -ErrorAction Stop } catch { continue }
  foreach ($k in $keys) {
    try {
      $p = Get-ItemProperty -LiteralPath $k.PSPath -ErrorAction Stop
      if (-not $p.DisplayName) { continue }
      if ($p.SystemComponent -eq 1) { continue }
      $sz = $null
      try { if ($p.EstimatedSize) { $sz = [uint64]$p.EstimatedSize * 1024 } } catch {}
      $items += [pscustomobject]@{
        id = ($h.root + '|' + $k.PSChildName)
        name = [string]$p.DisplayName
        version = [string]$p.DisplayVersion
        publisher = [string]$p.Publisher
        installDate = [string]$p.InstallDate
        size = $sz
        location = [string]$p.InstallLocation
        uninstall = [string]$p.UninstallString
      }
    } catch {}
  }
}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ apps = @($items) }) -Depth 4))
`

export function appUninstallScript(uninstallString: string): string {
  return `
${HEADER}
$us = ${psQuote(uninstallString)}
$exe = $null
$rest = ''
if ($us.StartsWith('"')) {
  $idx = $us.IndexOf('"', 1)
  if ($idx -gt 0) {
    $exe = $us.Substring(1, $idx - 1)
    if ($idx + 1 -lt $us.Length) { $rest = $us.Substring($idx + 1).Trim() }
  }
}
if (-not $exe) {
  $parts = @($us -split ' ')
  for ($i = 0; $i -lt $parts.Count; $i++) {
    $cand = ($parts[0..$i] -join ' ')
    if (Test-Path -LiteralPath $cand -PathType Leaf) {
      $exe = $cand
      if ($i + 1 -lt $parts.Count) { $rest = ($parts[($i + 1)..($parts.Count - 1)] -join ' ') }
      break
    }
  }
  if (-not $exe) {
    $exe = $parts[0]
    if ($parts.Count -gt 1) { $rest = ($parts[1..($parts.Count - 1)] -join ' ') }
  }
}
try {
  if ($rest) { Start-Process -FilePath $exe -ArgumentList $rest -ErrorAction Stop }
  else { Start-Process -FilePath $exe -ErrorAction Stop }
  Write-Output 'OK'
} catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

// ── Event log query ──────────────────────────────────────────────

export function eventQueryScript(log: string, levels: number[] | null, startMs: number, max: number): string {
  const levelsArr = levels ? `@(${levels.join(',')})` : '$null'
  return `
${HEADER}
$log = '${log}'
$levels = ${levelsArr}
$startMs = ${Math.max(0, Math.floor(startMs))}
$max = ${Math.max(1, Math.min(2000, Math.floor(max)))}
$ht = @{ LogName = $log; StartTime = [DateTimeOffset]::FromUnixTimeMilliseconds($startMs).LocalDateTime }
if ($null -ne $levels) { $ht['Level'] = $levels }
try {
  $evts = Get-WinEvent -FilterHashtable $ht -MaxEvents $max -ErrorAction Stop
  $list = @()
  foreach ($e in $evts) {
    $msg = ''
    try { $msg = [string]$e.Message } catch {}
    if ($msg.Length -gt 1200) { $msg = $msg.Substring(0, 1200) }
    $tm = 0
    try { $tm = [DateTimeOffset]::new($e.TimeCreated.ToUniversalTime()).ToUnixTimeMilliseconds() } catch {}
    $list += [pscustomobject]@{
      time = $tm
      recordId = [int64]$e.RecordId
      id = [int]$e.Id
      level = [int]$e.Level
      levelName = [string]$e.LevelDisplayName
      provider = [string]$e.ProviderName
      message = $msg
    }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ ok = $true; events = @($list) }) -Depth 4))
} catch {
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ ok = $false; events = @(); error = $_.Exception.Message }) -Depth 3))
}
`
}

// ── Disk scan (one-shot, streaming progress) ─────────────────────

export function diskScanScript(root: string): string {
  return `
${HEADER}
$root = ${psQuote(root)}
if (-not (Test-Path -LiteralPath $root -PathType Container)) {
  [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ type = 'error'; message = 'path not found' })))
  exit
}
$rootFull = (Get-Item -LiteralPath $root).FullName
if (-not $rootFull.EndsWith('\\')) { $rootFull = $rootFull + '\\' }
$prefix = '\\\\?\\' + $rootFull
$stack = New-Object System.Collections.Generic.Stack[string]
$stack.Push($prefix)
$childTotals = @{}
$childFiles = @{}
$rootFiles = New-Object System.Collections.Generic.List[object]
$topFiles = New-Object System.Collections.Generic.List[object]
$totalBytes = [uint64]0
$totalFiles = 0
$skipped = 0
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while ($stack.Count -gt 0) {
  $dir = $stack.Pop()
  try {
    $di = [System.IO.DirectoryInfo]::new($dir)
    foreach ($f in $di.EnumerateFiles()) {
      try {
        $len = [uint64]$f.Length
        $totalFiles = $totalFiles + 1
        $totalBytes = $totalBytes + $len
        $rel = $f.FullName.Substring($prefix.Length)
        if ($rel.Contains('\\')) {
          $seg = $rel.Split('\\')[0]
          if ($seg) {
            if (-not $childTotals.ContainsKey($seg)) { $childTotals[$seg] = [uint64]0; $childFiles[$seg] = 0 }
            $childTotals[$seg] = $childTotals[$seg] + $len
            $childFiles[$seg] = $childFiles[$seg] + 1
          }
        } else {
          $rootFiles.Add([pscustomobject]@{ p = $f.FullName; s = $len })
        }
        if ($len -gt 104857600) { $topFiles.Add([pscustomobject]@{ p = $f.FullName; s = $len }) }
      } catch { $skipped = $skipped + 1 }
      if (($totalFiles % 5000) -eq 0) {
        if ($topFiles.Count -gt 600) {
          $kept = @($topFiles | Sort-Object s -Descending | Select-Object -First 300)
          $topFiles = New-Object System.Collections.Generic.List[object]
          foreach ($x in $kept) { $topFiles.Add($x) }
        }
        [Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ type = 'progress'; files = $totalFiles; bytes = $totalBytes; skipped = $skipped; dir = $dir.Substring(4) })))
        [Console]::Out.Flush()
      }
    }
    foreach ($d in $di.EnumerateDirectories()) {
      try {
        if (($d.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { $stack.Push($d.FullName) } else { $skipped = $skipped + 1 }
      } catch { $skipped = $skipped + 1 }
    }
  } catch { $skipped = $skipped + 1 }
}
$children = @()
foreach ($k in $childTotals.Keys) { $children += [pscustomobject]@{ name = [string]$k; size = [uint64]$childTotals[$k]; files = [int]$childFiles[$k] } }
$children = @($children | Sort-Object size -Descending)
$largest = @($topFiles | Sort-Object s -Descending | Select-Object -First 50 | ForEach-Object { [pscustomobject]@{ path = $_.p.Substring(4); size = $_.s } })
$direct = @($rootFiles | Sort-Object s -Descending | Select-Object -First 30 | ForEach-Object { [pscustomobject]@{ path = $_.p.Substring(4); size = $_.s } })
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{
  type = 'done'; path = $rootFull; totalBytes = $totalBytes; totalFiles = $totalFiles; skipped = $skipped; elapsedSec = [int]$sw.Elapsed.TotalSeconds
  children = $children; largest = $largest; direct = $direct
}) -Depth 4))
`
}

// ── Task Scheduler ───────────────────────────────────────────────

export const TASKS_SCRIPT = `
${HEADER}
$tasks = @()
try {
  $all = @(Get-ScheduledTask -ErrorAction Stop)
  foreach ($t in $all) {
    $info = $null
    try { $info = Get-ScheduledTaskInfo -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction SilentlyContinue } catch {}
    $action = ''
    try {
      $a = $t.Actions | Select-Object -First 1
      if ($a) { $action = ([string]$a.Execute + ' ' + [string]$a.Arguments).Trim() }
    } catch {}
    $next = $null
    try { if ($info -and $info.NextRunTime) { $next = [DateTimeOffset]::new($info.NextRunTime).ToUnixTimeMilliseconds() } } catch {}
    $last = $null
    try { if ($info -and $info.LastRunTime) { $last = [DateTimeOffset]::new($info.LastRunTime).ToUnixTimeMilliseconds() } } catch {}
    $tasks += [pscustomobject]@{
      path = [string]$t.TaskPath
      name = [string]$t.TaskName
      state = [string]$t.State
      author = [string]$t.Author
      action = $action
      next = $next
      last = $last
      lastResult = if ($info) { [int]$info.LastTaskResult } else { $null }
    }
  }
} catch {}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ tasks = @($tasks) }) -Depth 4))
`

export function taskActionScript(taskPath: string, taskName: string, action: string): string {
  const cmd =
    action === 'run'
      ? 'Start-ScheduledTask'
      : action === 'stop'
        ? 'Stop-ScheduledTask'
        : action === 'enable'
          ? 'Enable-ScheduledTask'
          : 'Disable-ScheduledTask'
  return `
${HEADER}
try { ${cmd} -TaskPath ${psQuote(taskPath)} -TaskName ${psQuote(taskName)} -ErrorAction Stop; Write-Output 'OK' } catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

// ── Drivers ──────────────────────────────────────────────────────

export const DRIVERS_SCRIPT = `
${HEADER}
$drivers = @()
try {
  $drivers = @(Get-CimInstance -ClassName Win32_PnPSignedDriver -ErrorAction Stop |
    Where-Object { $_.DeviceName } |
    ForEach-Object {
      $dd = $null
      try { if ($_.DriverDate) { $dd = [DateTimeOffset]::new($_.DriverDate.ToUniversalTime()).ToUnixTimeMilliseconds() } } catch {}
      [pscustomobject]@{
        name = [string]$_.DeviceName
        friendly = [string]$_.FriendlyName
        version = [string]$_.DriverVersion
        date = $dd
        maker = [string]$_.Manufacturer
        signed = ($_.IsSigned -eq $true)
        inf = [string]$_.InfName
        class = [string]$_.DeviceClass
      }
    })
} catch {}
$problems = @()
try {
  $problems = @(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
    Where-Object { $_.ConfigManagerErrorCode -ne 0 } |
    ForEach-Object {
      [pscustomobject]@{ name = [string]$_.Name; code = [int]$_.ConfigManagerErrorCode; deviceId = [string]$_.DeviceID }
    })
} catch {}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ drivers = $drivers; problems = $problems }) -Depth 4))
`

// ── Power plans ──────────────────────────────────────────────────

export const POWER_SCRIPT = `
${HEADER}
$schemes = @()
$activeGuid = ''
try {
  $act = (powercfg /getactivescheme 2>$null) -join ' '
  if ($act -match '([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})') { $activeGuid = $Matches[1].ToLower() }
} catch {}
try {
  $lines = @(powercfg /list 2>$null)
  foreach ($line in $lines) {
    if ($line -match '([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})') {
      $g = $Matches[1].ToLower()
      $name = ''
      if ($line -match '\\(([^)]+)\\)') { $name = $Matches[1] }
      $schemes += [pscustomobject]@{ guid = $g; name = $name; active = ($g -eq $activeGuid) }
    }
  }
} catch {}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ schemes = @($schemes) }) -Depth 3))
`

export function powerSetActiveScript(guid: string): string {
  return `
${HEADER}
try { powercfg /setactive ${guid} 2>$null; if ($LASTEXITCODE -eq 0) { Write-Output 'OK' } else { Write-Output 'ERR:powercfg failed' } } catch { Write-Output ('ERR:' + $_.Exception.Message) }
`
}

// ── Cleanup Center ───────────────────────────────────────────────

export function cleanupScanScript(root: string, pattern: string | null, recursive: boolean): string {
  const p = pattern ? psQuote(pattern) : '$null'
  const recurse = recursive ? '-Recurse ' : ''
  return `
${HEADER}
$root = ${psQuote(root)}
$pattern = ${p}
$bytes = [uint64]0
$n = 0
$skipped = 0
$top = New-Object System.Collections.Generic.List[object]
try {
  if ($null -ne $pattern) {
    $files = @(Get-ChildItem -LiteralPath $root -Filter $pattern -File -Force -ErrorAction SilentlyContinue)
  } else {
    $files = @(Get-ChildItem -LiteralPath $root ${recurse}-File -Force -ErrorAction SilentlyContinue)
  }
  foreach ($f in $files) {
    try {
      $bytes = $bytes + [uint64]$f.Length
      $n = $n + 1
      if ($f.Length -gt 52428800) { $top.Add([pscustomobject]@{ path = [string]$f.FullName; size = [uint64]$f.Length }) }
    } catch { $skipped = $skipped + 1 }
  }
} catch { $skipped = $skipped + 1 }
$topOut = @($top | Sort-Object size -Descending | Select-Object -First 10)
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ ok = $true; bytes = $bytes; files = $n; skipped = $skipped; top = $topOut }) -Depth 3))
`
}

export function cleanupCleanScript(root: string, pattern: string | null, recursive: boolean, cutoffMs: number): string {
  const p = pattern ? psQuote(pattern) : '$null'
  const recurse = recursive ? '-Recurse ' : ''
  return `
${HEADER}
$root = ${psQuote(root)}
$pattern = ${p}
$cutoff = [DateTimeOffset]::FromUnixTimeMilliseconds(${Math.max(0, Math.floor(cutoffMs))}).UtcDateTime
$removed = 0
$removedBytes = [uint64]0
$failed = 0
try {
  if ($null -ne $pattern) {
    $files = @(Get-ChildItem -LiteralPath $root -Filter $pattern -File -Force -ErrorAction SilentlyContinue)
  } else {
    $files = @(Get-ChildItem -LiteralPath $root ${recurse}-File -Force -ErrorAction SilentlyContinue)
  }
  foreach ($f in $files) {
    if ($f.LastWriteTimeUtc -ge $cutoff) { continue }
    try {
      $sz = [uint64]$f.Length
      Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
      $removed = $removed + 1
      $removedBytes = $removedBytes + $sz
    } catch { $failed = $failed + 1 }
  }
} catch { $failed = $failed + 1 }
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ ok = $true; removed = $removed; removedBytes = $removedBytes; failed = $failed }) -Depth 3))
`
}

// ── System health ────────────────────────────────────────────────

export const HEALTH_SCRIPT = `
${HEADER}
$disks = @()
try {
  Get-PhysicalDisk -ErrorAction Stop | ForEach-Object {
    $rel = $null
    try { $rel = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue } catch {}
    $disks += [pscustomobject]@{
      model = [string]$_.FriendlyName
      media = [string]$_.MediaType
      health = [string]$_.HealthStatus
      temp = if ($rel -and $rel.Temperature) { [int]$rel.Temperature } else { $null }
      wear = if ($rel -and $rel.Wear) { [int]$rel.Wear } else { $null }
      readErr = if ($rel -and $rel.ReadErrorsTotal) { [uint64]$rel.ReadErrorsTotal } else { $null }
      writeErr = if ($rel -and $rel.WriteErrorsTotal) { [uint64]$rel.WriteErrorsTotal } else { $null }
      powerOnHours = if ($rel -and $rel.PowerOnHours) { [uint64]$rel.PowerOnHours } else { $null }
    }
  }
} catch {}
$temps = @()
try {
  Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | ForEach-Object {
    $c = [math]::Round(($_.CurrentTemperature / 10) - 273.15, 1)
    if ($c -gt -50 -and $c -lt 150) {
      $temps += [pscustomobject]@{ zone = [string]$_.InstanceName; c = $c }
    }
  }
} catch {}
$batt = $null
try {
  $b = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($b) {
    $rt = $null
    try { if ($b.EstimatedRunTime -gt 0 -and $b.EstimatedRunTime -lt 71582788) { $rt = [int]$b.EstimatedRunTime } } catch {}
    $batt = [pscustomobject]@{
      pct = if ($b.EstimatedChargeRemaining) { [int]$b.EstimatedChargeRemaining } else { $null }
      charging = ($b.BatteryStatus -eq 2)
      voltage = if ($b.DesignVoltage) { [int]$b.DesignVoltage } else { $null }
      runtimeSec = $rt
      status = [string]$b.BatteryStatus
    }
  }
} catch {}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ disks = @($disks); temps = @($temps); battery = $batt }) -Depth 4))
`

// ── Diagnostics inputs ───────────────────────────────────────────

export const DIAG_INPUTS_SCRIPT = `
${HEADER}
$pending = $false
try {
  if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending') { $pending = $true }
  if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') { $pending = $true }
  $pfr = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager' -Name PendingFileRenameOperations -ErrorAction SilentlyContinue
  if ($pfr -and $pfr.PendingFileRenameOperations) { $pending = $true }
} catch {}
$av = @()
try {
  $av = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction Stop | ForEach-Object {
    [pscustomobject]@{ name = [string]$_.displayName; state = [string]$_.productState }
  })
} catch {}
$sysErr = 0
$appErr = 0
try {
  $cut = (Get-Date).AddDays(-1)
  $sysErr = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = 1, 2; StartTime = $cut } -MaxEvents 1000 -ErrorAction SilentlyContinue).Count
  $appErr = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Level = 1, 2; StartTime = $cut } -MaxEvents 1000 -ErrorAction SilentlyContinue).Count
} catch {}
$pf = $null
try {
  $p = Get-CimInstance -ClassName Win32_PageFileUsage -ErrorAction Stop | Select-Object -First 1
  if ($p) { $pf = [pscustomobject]@{ alloc = [int]$p.AllocatedBaseSize; used = [int]$p.CurrentUsage } }
} catch {}
[Console]::Out.WriteLine((ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ pendingReboot = $pending; av = @($av); sysErrors = $sysErr; appErrors = $appErr; pagefile = $pf }) -Depth 3))
`
