<#
  Send a keystroke to a Claude Code session's window (Windows) — used by the
  dashboard's "quick keys" to answer interactive prompts (plan approval, permission
  choices, y/n) remotely. Finds the window whose title contains -Match (the project
  name), activates it by PID, and sends -Keys via SendKeys.

    powershell -ExecutionPolicy Bypass -File scripts\sendkeys.ps1 -Match "WaivePulse" -Keys "1{ENTER}"

  -Keys uses WScript.Shell SendKeys syntax: {ENTER} {ESC} {TAB} {UP} {DOWN}, plain chars.
  CAVEAT: steals focus and types into whatever control is focused in that window — keep
  the Claude terminal focused. Try -DryRun first.
#>
param([int]$Port = 3131, [string]$Match = '', [string]$Keys = '', [int]$WinPid = 0, [switch]$DryRun)

if ($Keys -eq '') { Write-Host "[sendkeys] need -Keys"; exit 0 }
if (-not $Match -and $WinPid -le 0) { Write-Host "[sendkeys] need -Match or -WinPid"; exit 0 }

try {
  Add-Type -ErrorAction Stop @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class HmKeys {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr p);
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static uint FindPid(string needle) {
    uint found = 0;
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      int len = GetWindowTextLength(h);
      if (len <= 0) return true;
      var sb = new StringBuilder(len + 1);
      GetWindowText(h, sb, sb.Capacity);
      if (sb.ToString().IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0) {
        uint pid; GetWindowThreadProcessId(h, out pid); found = pid; return false;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
} catch {}

$wsh = New-Object -ComObject WScript.Shell
function SendTo($p) {
  if ($DryRun) { Write-Host "[sendkeys] would send '$Keys' to pid $p"; return $true }
  if ($wsh.AppActivate([int]$p)) { Start-Sleep -Milliseconds 250; $wsh.SendKeys($Keys); return $true }
  return $false
}

# 1) Prefer the PID captured at launch (survives Claude renaming the title to "Claude Code").
if ($WinPid -gt 0) {
  Write-Host "[sendkeys] '$Keys' -> captured pid $WinPid"
  if (SendTo $WinPid) { exit 0 }
  Write-Host "[sendkeys] captured pid $WinPid not activatable; trying title"
}

# 2) Fall back to matching the window by title (works for VS Code-hosted sessions).
if ($Match) {
  $procId = [HmKeys]::FindPid($Match)
  if (-not $procId) { Write-Host "[sendkeys] no open window contains '$Match'"; exit 0 }
  Write-Host "[sendkeys] '$Keys' -> window containing '$Match' (pid $procId)"
  if (-not (SendTo $procId)) { Write-Host "[sendkeys] found pid $procId but could not activate it" }
} else {
  Write-Host "[sendkeys] no open window contains '$Match'"
}
