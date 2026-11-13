import { chmodSync, writeFileSync } from 'fs';
import { join } from 'path';

export type StubGo2rtcMode = 'run' | 'crash' | 'ignore-sigterm' | 'flood';

export const STUB_GO2RTC_READY_LINE = 'stub signal handlers ready';

/**
 * Writes an executable `node` script named `go2rtc` into `dir` and returns its path. Every mode prints its argv and the
 * password on stdout, the names of its environment variables and a source url on stderr, then `STUB_GO2RTC_READY_LINE`
 * on stdout once its signal handlers are installed. `flood` then prints `line 0`..`line 99` and writes nothing to
 * stderr: ordering across the two pipes is undefined, so a single stream keeps "the last line" deterministic.
 */
export function writeStubGo2rtcScript(dir: string, mode: StubGo2rtcMode): string {
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
		`process.stdout.write(${JSON.stringify(`${STUB_GO2RTC_READY_LINE}\n`)});`,
		'if (mode === "flood") {',
		'  for (let i = 0; i < 100; i++) {',
		'    process.stdout.write(`line ${i}\\n`);',
		'  }',
		'}',
		'setInterval(() => {}, 60000);',
		'',
	].join('\n');

	const path = join(dir, 'go2rtc');

	writeFileSync(path, script);
	chmodSync(path, 0o755);

	return path;
}
