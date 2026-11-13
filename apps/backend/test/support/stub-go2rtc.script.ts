import { chmodSync, writeFileSync } from 'fs';
import { join } from 'path';

export type StubGo2rtcMode = 'run' | 'crash' | 'ignore-sigterm' | 'flood' | 'split' | 'tail' | 'serve';

export interface StubGo2rtcOptions {
	/** `serve` mode: the `config_path` the stub reports instead of its `-config` argument (a foreign service). */
	reportedConfigPath?: string;
	/** `serve` mode: the body `GET /api/config` returns instead of the `-config` file (a foreign service). */
	reportedConfigText?: string;
	/** `serve` mode: on SIGTERM print the real API password and instance secret on stdout, then exit 0. */
	emitSecretsOnSigterm?: boolean;
}

export const STUB_GO2RTC_READY_LINE = 'stub signal handlers ready';

/**
 * Writes an executable `node` script named `go2rtc` into `dir` and returns its path. Every mode prints its argv and the
 * password on stdout, the names of its environment variables and a source url on stderr, then `STUB_GO2RTC_READY_LINE`
 * on stdout once its signal handlers are installed. `flood` then prints `line 0`..`line 99` and writes nothing to
 * stderr: ordering across the two pipes is undefined, so a single stream keeps "the last line" deterministic. `split`
 * writes the password (stdout) and a source url (stderr) in two halves 300 ms apart, newline only after the second
 * half. `tail` writes an unterminated line holding both secrets and exits 0. `serve` reads the `-config` file it was
 * given, listens on its `api.listen` address and answers `GET /api` with
 * `{ version, revision, config_path, host }` (like go2rtc's `app.Info`) and `GET /api/config` with the config file content,
 * both only when the `Authorization` header matches the file's `api` credentials (401 otherwise).
 */
export function writeStubGo2rtcScript(dir: string, mode: StubGo2rtcMode, options: StubGo2rtcOptions = {}): string {
	const script = [
		'#!/usr/bin/env node',
		"'use strict';",
		`const mode = ${JSON.stringify(mode)};`,
		'process.stdout.write(`stub argv=${process.argv.slice(2).join(" ")}\\n`);',
		'process.stdout.write("stub password=PW_SENTINEL_abcdef0123\\n");',
		'if (mode !== "flood") {',
		'  process.stderr.write(`stub env=${Object.keys(process.env).sort().join(",")}\\n`);',
		'  process.stderr.write("stub source=rtsps://console:7441/SENTINELALIAS0123456789\\n");',
		'}',
		'if (mode === "crash") {',
		'  process.exit(3);',
		'}',
		'if (mode === "ignore-sigterm") {',
		'  process.on("SIGTERM", () => {});',
		'}',
		`const reportedConfigPath = ${JSON.stringify(options.reportedConfigPath ?? null)};`,
		`const reportedConfigText = ${JSON.stringify(options.reportedConfigText ?? null)};`,
		`const emitSecretsOnSigterm = ${JSON.stringify(options.emitSecretsOnSigterm ?? false)};`,
		SERVE_SOURCE,
		'if (mode === "tail") {',
		'  process.stdout.write("stub tail rtsps://console:7441/SENTINELALIAS0123456789 pw=PW_SENTINEL_abcdef0123");',
		'  process.exit(0);',
		'}',
		'const ready = () => {',
		`  process.stdout.write(${JSON.stringify(`${STUB_GO2RTC_READY_LINE}\n`)});`,
		'  if (mode === "flood") {',
		'    for (let i = 0; i < 100; i++) {',
		'      process.stdout.write(`line ${i}\\n`);',
		'    }',
		'  }',
		'  setInterval(() => {}, 60000);',
		'};',
		'if (mode === "split") {',
		'  process.stdout.write("stub split pw=PW_SENT");',
		'  process.stderr.write("stub split url=rtsps://console:7441/SENTINEL");',
		'  setTimeout(() => {',
		'    process.stdout.write("INEL_abcdef0123\\n");',
		'    process.stderr.write("ALIAS0123456789\\n");',
		'    ready();',
		'  }, 300);',
		'} else {',
		'  ready();',
		'}',
		'',
	].join('\n');

	const path = join(dir, 'go2rtc');

	writeFileSync(path, script);
	chmodSync(path, 0o755);

	return path;
}

const SERVE_SOURCE = String.raw`
if (mode === "serve") {
  const fs = require("fs");
  const http = require("http");
  const args = process.argv.slice(2);
  const configPath = args[args.indexOf("-config") + 1];
  const cfg = {};
  let section = "";
  for (const line of fs.readFileSync(configPath, "utf8").split("\n")) {
    if (/^\S.*:$/.test(line)) {
      section = line.slice(0, -1);
      cfg[section] = {};
      continue;
    }
    const m = line.match(/^\s+([a-z_]+): *(.*)$/);
    if (m && section) {
      cfg[section][m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const expected = "Basic " + Buffer.from(cfg.api.username + ":" + cfg.api.password).toString("base64");
  const host = cfg.api.listen;
  if (emitSecretsOnSigterm) {
    const instance = /^# smart-panel-instance (\S+)$/m.exec(fs.readFileSync(configPath, "utf8"));
    process.on("SIGTERM", () => {
      process.stdout.write("stub shutdown password=" + cfg.api.password + " instance=" + (instance ? instance[1] : "") + "\n", () => process.exit(0));
    });
  }
  http
    .createServer((req, res) => {
      if (req.method !== "GET" || (req.url !== "/api" && req.url !== "/api/config")) {
        res.writeHead(404);
        res.end();
        return;
      }
      if (req.headers.authorization !== expected) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
      if (req.url === "/api/config") {
        res.writeHead(200, { "content-type": "application/yaml" });
        res.end(reportedConfigText === null ? fs.readFileSync(configPath, "utf8") : reportedConfigText);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          version: "1.9.9-stub",
          revision: "stub",
          config_path: reportedConfigPath === null ? configPath : reportedConfigPath,
          host,
        }),
      );
    })
    .listen(Number(host.split(":")[1]), "127.0.0.1");
}
`;
