import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

// Read only the Supabase CLI credential. Child stdout is captured in memory;
// neither the token nor headers are written to logs or configuration files.
const credentialReader = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class CTSupabaseCredential {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Credential {
    public UInt32 Flags; public UInt32 Type; public IntPtr TargetName; public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob;
    public UInt32 Persist; public UInt32 AttributeCount; public IntPtr Attributes;
    public IntPtr TargetAlias; public IntPtr UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr credential);
}
'@
foreach ($taskTarget in @('Supabase CLI:supabase', 'Supabase CLI:access-token')) {
  $taskPointer = [IntPtr]::Zero
  if ([CTSupabaseCredential]::CredRead($taskTarget, 1, 0, [ref]$taskPointer)) {
    try {
      $taskCredential = [Runtime.InteropServices.Marshal]::PtrToStructure($taskPointer, [type][CTSupabaseCredential+Credential])
      $taskBytes = New-Object byte[] $taskCredential.CredentialBlobSize
      [Runtime.InteropServices.Marshal]::Copy($taskCredential.CredentialBlob, $taskBytes, 0, $taskBytes.Length)
      $taskToken = [Text.Encoding]::UTF8.GetString($taskBytes).Trim([char]0)
      if ($taskToken.StartsWith('go-keyring-base64:')) { $taskToken = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($taskToken.Substring(18))) }
      [Console]::Out.Write($taskToken)
      exit 0
    } finally { [CTSupabaseCredential]::CredFree($taskPointer) }
  }
}
exit 1
`;

export async function managementAccessToken() {
  let token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token && process.platform === "win32") {
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", credentialReader], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
    if (result.status === 0) token = result.stdout;
  }
  if (!token) token = await readFile(path.join(homedir(), ".supabase/access-token"), "utf8").catch(() => "");
  token = token.trim();
  if (!/^sbp_[A-Za-z0-9._-]+$/.test(token)) throw new Error("Không đọc được phiên CLI Supabase hợp lệ; cần đăng nhập supabase login");
  return token;
}

export async function managementClient() {
  const token = await managementAccessToken();
  return async (method, route, body) => {
    if (!/^\/v1\/(organizations|projects)(\/|$)/.test(route) || route.includes("..") || route.includes("#")) throw new Error("Management route không hợp lệ");
    const response = await fetch(`https://api.supabase.com${route}`, {
      method, redirect: "error", signal: AbortSignal.timeout(60_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      let message = typeof payload?.message === "string" ? payload.message : typeof payload?.error === "string" ? payload.error : "Request bị từ chối";
      for (const secret of [token, body?.db_pass].filter(Boolean)) message = message.split(secret).join("[redacted]");
      message = message.replace(/(?:sbp_|sb_secret_|sb_publishable_)[A-Za-z0-9._-]+/g, "[redacted]");
      throw new Error(`Supabase ${response.status}: ${message}`);
    }
    return payload;
  };
}
