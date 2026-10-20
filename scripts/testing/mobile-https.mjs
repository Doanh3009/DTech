import assert from "node:assert/strict";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadTestConfiguration, reportTestingError } from "./config.mjs";
import { assertSeedTarget } from "./guard.mjs";

const directory = path.resolve("test-results/mobile-https");
const credentialsPath = path.join(directory, "access.private.json");
const linkPath = path.join(directory, "link.json");
const release = "2026.10.0";
const executable = path.join(directory, "tools", "cloudflared.exe");

async function prepare() {
  assert(process.platform === "win32" && process.arch === "x64", "Mobile HTTPS hiện dành cho Windows x64");
  const { env, baseUrl } = await loadTestConfiguration();
  assert(baseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseUrl.hostname), "Chỉ chuyển tiếp server test trên máy local");
  await assertSeedTarget(env);
  await mkdir(path.dirname(executable), { recursive: true });
  let credentials = await readFile(credentialsPath, "utf8").then(JSON.parse).catch(() => null);
  if (!credentials) {
    credentials = { username: "tester", password: randomBytes(24).toString("base64url") };
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  }
  assert(credentials.username === "tester" && /^[A-Za-z0-9_-]{32}$/.test(credentials.password), "Thông tin truy cập HTTPS không hợp lệ");
  const response = await fetch(`https://api.github.com/repos/cloudflare/cloudflared/releases/tags/${release}`, { headers: { "user-agent": "CT-NoiBo-mobile-dev" }, signal: AbortSignal.timeout(20_000) });
  assert(response.ok, "Không đọc được bản phát hành cloudflared chính thức");
  const metadata = await response.json();
  const asset = metadata.assets.find(item => item.name === "cloudflared-windows-amd64.exe");
  assert(asset && /^sha256:[a-f0-9]{64}$/.test(asset.digest), "Không tìm thấy checksum cloudflared");
  assert(asset.browser_download_url === `https://github.com/cloudflare/cloudflared/releases/download/${release}/cloudflared-windows-amd64.exe`, "Nguồn tải cloudflared không hợp lệ");
  let bytes = await readFile(executable).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== asset.digest.slice(7)) {
    const download = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(120_000) });
    assert(download.ok, "Không tải được cloudflared");
    bytes = Buffer.from(await download.arrayBuffer());
    assert(createHash("sha256").update(bytes).digest("hex") === asset.digest.slice(7), "Checksum cloudflared không khớp");
    await writeFile(executable, bytes);
  }
  console.log("Đã chuẩn bị HTTPS. Thông tin truy cập: test-results/mobile-https/access.private.json");
  return { baseUrl, credentials };
}

async function share({ baseUrl, credentials }) {
  const expected = Buffer.from(`Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`);
  const authorized = req => {
    const supplied = Buffer.from(req.headers.authorization ?? "");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  };
  const trustedHost = req => typeof req.headers.host === "string" && /^[a-z0-9-]+\.trycloudflare\.com$/.test(req.headers.host);
  const allowedOrigin = req => !req.headers.origin || req.headers.origin === `https://${req.headers.host}`;
  const forwardedHeaders = req => {
    const headers = { ...req.headers, host: baseUrl.host, "x-forwarded-host": baseUrl.host, "x-forwarded-proto": "http" };
    delete headers.authorization;
    delete headers.forwarded;
    if (headers.origin) headers.origin = baseUrl.origin;
    if (headers.referer) {
      try { const referer = new URL(headers.referer); headers.referer = `${baseUrl.origin}${referer.pathname}${referer.search}`; } catch { delete headers.referer; }
    }
    return headers;
  };
  const gateway = createServer((req, res) => {
    if (!trustedHost(req)) { res.writeHead(403); res.end("Invalid host"); return; }
    if (!authorized(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="CT NoiBo Mobile Test", charset="UTF-8"', "Cache-Control": "no-store" });
      res.end("Mobile test access required"); return;
    }
    if (!allowedOrigin(req)) { res.writeHead(403); res.end("Invalid origin"); return; }
    const upstream = httpRequest({ hostname: baseUrl.hostname, port: baseUrl.port || 80, path: req.url, method: req.method, headers: forwardedHeaders(req) }, response => {
      const headers = { ...response.headers, "Cache-Control": "no-store", "Permissions-Policy": "camera=(self), geolocation=(self), microphone=()" };
      if (typeof headers.location === "string" && headers.location.startsWith(baseUrl.origin + "/")) headers.location = `https://${req.headers.host}${headers.location.slice(baseUrl.origin.length)}`;
      res.writeHead(response.statusCode ?? 502, headers);
      response.pipe(res);
    });
    upstream.setTimeout(120_000, () => upstream.destroy());
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("Local test server unavailable"); });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  });
  gateway.on("upgrade", (req, socket, head) => {
    if (!trustedHost(req) || !authorized(req) || !allowedOrigin(req)) { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return; }
    const upstream = httpRequest({ hostname: baseUrl.hostname, port: baseUrl.port || 80, path: req.url, method: req.method, headers: forwardedHeaders(req) });
    upstream.on("upgrade", (response, remote, remoteHead) => {
      const headers = Object.entries(response.headers).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).filter(value => value !== undefined).map(value => `${key}: ${value}`));
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers.join("\r\n")}\r\n\r\n`);
      if (remoteHead.length) socket.write(remoteHead);
      if (head.length) remote.write(head);
      remote.pipe(socket); socket.pipe(remote);
      socket.on("close", () => remote.destroy()); remote.on("error", () => socket.destroy());
    });
    upstream.on("error", () => socket.destroy()); socket.on("error", () => upstream.destroy());
    upstream.end();
  });
  await new Promise((resolve, reject) => { gateway.once("error", reject); gateway.listen(3344, "127.0.0.1", resolve); });
  await rm(linkPath, { force: true });
  const child = spawn(executable, ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", "http://127.0.0.1:3344"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let publicUrl;
  let logTail = "";
  const recordLink = async chunk => {
    logTail = (logTail + chunk.toString()).slice(-10_000);
    const match = logTail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!publicUrl && match) {
      publicUrl = match[0];
      await writeFile(linkPath, JSON.stringify({ url: publicUrl, pid: process.pid, createdAt: new Date().toISOString() }, null, 2) + "\n");
      console.log(`Link điện thoại: ${publicUrl}/login`);
      console.log("Đăng nhập lớp bảo vệ bằng thông tin trong access.private.json, rồi chọn tài khoản kiểm thử.");
    }
  };
  child.stdout.on("data", chunk => { void recordLink(chunk); });
  child.stderr.on("data", chunk => { void recordLink(chunk); });
  const deadline = setTimeout(() => { if (!publicUrl) { console.error("Chưa tạo được link HTTPS. Kiểm tra kết nối Cloudflare."); child.kill(); } }, 45_000);
  let stopping = false;
  const shutdown = async () => { if (stopping) return; stopping = true; clearTimeout(deadline); child.kill(); gateway.closeAllConnections(); gateway.close(); await rm(linkPath, { force: true }); };
  child.on("error", () => { console.error("Không mở được cloudflared"); void shutdown(); process.exitCode = 1; });
  child.on("exit", code => { void shutdown(); process.exitCode = code ?? 1; });
  process.once("SIGINT", () => { void shutdown(); }); process.once("SIGTERM", () => { void shutdown(); });
  console.log("Đang tạo link HTTPS có mật khẩu; Ctrl+C để đóng link.");
}

try {
  const action = process.argv[2];
  assert(["prepare", "share"].includes(action), "Chọn prepare hoặc share");
  const configuration = await prepare();
  if (action === "share") await share(configuration);
} catch (error) { reportTestingError(error); }
