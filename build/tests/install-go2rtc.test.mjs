import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
	symlinkSync,
	utimesSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('pin.env lists a version and one 64-hex checksum for each supported architecture', () => {
	const entries = new Map();

	for (const line of read('build/go2rtc/pin.env').split('\n')) {
		if (line.trim() === '' || line.startsWith('#')) {
			continue;
		}

		const separator = line.indexOf('=');

		assert.notEqual(separator, -1, `not a KEY=value line: ${line}`);
		entries.set(line.slice(0, separator), line.slice(separator + 1));
	}

	assert.deepEqual([...entries.keys()].sort(), [
		'GO2RTC_SHA256_LINUX_AMD64',
		'GO2RTC_SHA256_LINUX_ARM',
		'GO2RTC_SHA256_LINUX_ARM64',
		'GO2RTC_VERSION',
	]);
	assert.match(entries.get('GO2RTC_VERSION'), /^\d+\.\d+\.\d+$/);

	for (const key of ['GO2RTC_SHA256_LINUX_AMD64', 'GO2RTC_SHA256_LINUX_ARM64', 'GO2RTC_SHA256_LINUX_ARM']) {
		assert.match(entries.get(key), /^[0-9a-f]{64}$/, key);
	}
});

test('THIRD-PARTY-NOTICES.md names go2rtc, its MIT licence and reproduces the pinned licence text verbatim', () => {
	const notices = read('THIRD-PARTY-NOTICES.md');

	assert.ok(notices.includes('go2rtc'));
	assert.ok(notices.includes('MIT'));
	assert.ok(notices.includes('https://github.com/AlexxIT/go2rtc'));
	assert.ok(notices.includes(read('build/go2rtc/LICENSE').trim()));
});

const SCRIPT = fileURLToPath(new URL('build/go2rtc/install-go2rtc.sh', root));
const REAL_LICENSE = read('build/go2rtc/LICENSE');
// The shell that runs the script; override to check portability, e.g. GO2RTC_TEST_SHELL=/bin/dash.
const SHELL = process.env.GO2RTC_TEST_SHELL ?? '/bin/sh';
const VERSION = '9.9.9';
const ASSETS = ['go2rtc_linux_amd64', 'go2rtc_linux_arm64', 'go2rtc_linux_arm'];
const PIN_KEYS = ['GO2RTC_SHA256_LINUX_AMD64', 'GO2RTC_SHA256_LINUX_ARM64', 'GO2RTC_SHA256_LINUX_ARM'];
const TOOLBOX =
	'sh mktemp mv cp rm mkdir chmod cat grep sed tr awk dirname basename id printf head install ls find'.split(' ');

const STUB = '#!/bin/sh\necho "go2rtc version 9.9.9 (stub) linux/test"\n';
const sha256 = (content) => createHash('sha256').update(content).digest('hex');

// Directories created by the tests must not be group-writable whatever the caller's umask: the installer refuses those.
process.umask(0o022);

/** True when every directory from dir up to / is owned by root or this user and not group- or world-writable. */
const chainIsTrusted = (dir) => {
	let current = realpathSync(dir);

	for (;;) {
		const info = statSync(current);

		if ((info.uid !== 0 && info.uid !== process.getuid()) || (info.mode & 0o022) !== 0) {
			return false;
		}

		const parent = dirname(current);

		if (parent === current) {
			return true;
		}

		current = parent;
	}
};

// The installer refuses a world-writable ancestor, and /tmp is one on Linux: the happy path needs a base directory
// whose whole parent chain it accepts, so fall back to a cache directory inside the checkout.
const sandboxBase = [tmpdir(), join(fileURLToPath(root), 'node_modules', '.cache')].find((candidate) => {
	mkdirSync(candidate, { recursive: true });

	return chainIsTrusted(candidate);
});

if (sandboxBase === undefined) {
	throw new Error('no directory with a trusted parent chain is available for the sandboxes');
}

const sandboxes = [];

after(() => {
	for (const sandbox of sandboxes) {
		rmSync(sandbox.root, { recursive: true, force: true });
	}
});

const findOnPath = (name) =>
	process.env.PATH.split(delimiter)
		.map((dir) => join(dir, name))
		.find((candidate) => existsSync(candidate));

const script = (lines) => `#!/bin/sh\n${lines.join('\n')}\n`;

const writeExecutable = (path, content) => {
	writeFileSync(path, content);
	chmodSync(path, 0o755);
};

const pinContent = (hashes, version = VERSION) =>
	[`GO2RTC_VERSION=${version}`, ...PIN_KEYS.map((key, index) => `${key}=${hashes[index] ?? hashes[0]}`)].join('\n') +
	'\n';

/**
 * A sandbox with fake uname/dpkg/curl and a toolbox of symlinks to the real tools the script needs. The script
 * runs with PATH=<sandbox>/bin:<sandbox>/toolbox only, so the real curl, dpkg and uname are never reachable and
 * nothing depends on the host.
 */
const makeSandbox = ({ uname = 'x86_64', dpkg, curl = true, omit = [], binary = STUB } = {}) => {
	const sandboxRoot = mkdtempSync(join(sandboxBase, 'install-go2rtc-'));
	const sandbox = {
		root: sandboxRoot,
		bin: join(sandboxRoot, 'bin'),
		toolbox: join(sandboxRoot, 'toolbox'),
		served: join(sandboxRoot, 'served'),
		pin: join(sandboxRoot, 'pin.env'),
		curlLog: join(sandboxRoot, 'curl.log'),
		dir: join(sandboxRoot, 'install', 'go2rtc'),
	};

	for (const dir of [sandbox.bin, sandbox.toolbox, sandbox.served]) {
		mkdirSync(dir, { recursive: true });
	}

	for (const tool of [...TOOLBOX, 'sha256sum', 'shasum']) {
		const real = findOnPath(tool);

		if (real && !omit.includes(tool)) {
			symlinkSync(real, join(sandbox.toolbox, tool));
		}
	}

	writeExecutable(join(sandbox.bin, 'uname'), script([`[ "$1" = -m ] && echo '${uname}'`]));

	if (dpkg !== undefined) {
		writeExecutable(join(sandbox.bin, 'dpkg'), script([`[ "$1" = --print-architecture ] && echo '${dpkg}'`]));
	}

	if (curl) {
		writeExecutable(
			join(sandbox.bin, 'curl'),
			script([
				`echo "$*" >> '${sandbox.curlLog}'`,
				"out=''; url=''",
				'while [ $# -gt 0 ]; do',
				'  case $1 in -o) out=$2; shift ;; http*) url=$1 ;; esac',
				'  shift',
				'done',
				`file='${sandbox.served}'/$(basename "$url")`,
				'[ -f "$file" ] || exit 22',
				`if [ -f '${sandbox.root}/curl.mode' ] && [ "$(cat '${sandbox.root}/curl.mode')" = truncate ]; then`,
				'  head -c 20 "$file" > "$out"; exit 18',
				'fi',
				'cp "$file" "$out"',
			]),
		);
	}

	serve(sandbox, binary);
	sandboxes.push(sandbox);

	return sandbox;
};

/** Serves the content under all three asset names and writes a pin file with its SHA-256. */
const serve = (sandbox, content) => {
	for (const asset of ASSETS) {
		writeFileSync(join(sandbox.served, asset), content);
	}

	writeFileSync(sandbox.pin, pinContent([sha256(content)]));
};

const run = (sandbox, args, env = {}) => {
	const result = spawnSync(SHELL, [SCRIPT, ...args], {
		encoding: 'utf8',
		env: {
			PATH: `${sandbox.bin}${delimiter}${sandbox.toolbox}`,
			FB_GO2RTC_PIN_FILE: sandbox.pin,
			FB_GO2RTC_SKIP_FILE: join(sandbox.root, 'no-such-marker'),
			...env,
		},
	});

	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
	};
};

const curlLines = (sandbox) =>
	existsSync(sandbox.curlLog) ? readFileSync(sandbox.curlLog, 'utf8').split('\n').filter(Boolean) : [];

const mode = (path) => statSync(path).mode & 0o777;

/** The pid of a process that has just exited. */
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;

test('installs the pinned binary for amd64', () => {
	const sandbox = makeSandbox();
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(join(sandbox.dir, 'go2rtc'), 'utf8'), STUB);
	assert.equal(mode(join(sandbox.dir, 'go2rtc')), 0o755);
	assert.equal(readFileSync(join(sandbox.dir, 'LICENSE'), 'utf8'), REAL_LICENSE);
	assert.equal(mode(join(sandbox.dir, 'LICENSE')), 0o644);
	assert.equal(mode(sandbox.dir), 0o755);
	assert.equal(curlLines(sandbox).length, 1);
	assert.ok(curlLines(sandbox)[0].includes('/releases/download/v9.9.9/go2rtc_linux_amd64'));
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['LICENSE', 'go2rtc']);
	assert.ok(result.stdout.includes('go2rtc: installed 9.9.9'), result.stdout);
});

test('creates world-searchable directories under a restrictive caller umask', () => {
	const sandbox = makeSandbox();
	const parent = join(sandbox.root, 'new-parent');
	const dir = join(parent, 'go2rtc');
	const result = spawnSync(SHELL, ['-c', 'umask 027; exec "$0" "$@"', SHELL, SCRIPT, '--arch', 'amd64', '--dir', dir], {
		encoding: 'utf8',
		env: {
			PATH: `${sandbox.bin}${delimiter}${sandbox.toolbox}`,
			FB_GO2RTC_PIN_FILE: sandbox.pin,
			FB_GO2RTC_SKIP_FILE: join(sandbox.root, 'no-such-marker'),
		},
	});

	assert.equal(result.status, 0, result.stderr);
	assert.equal(mode(parent), 0o755);
	assert.equal(mode(dir), 0o755);
	assert.equal(mode(join(dir, 'go2rtc')), 0o755);
	assert.equal(mode(join(dir, 'LICENSE')), 0o644);
	assert.deepEqual(readdirSync(dir).sort(), ['LICENSE', 'go2rtc']);
});

test('downloads over https with the documented curl flags', () => {
	const sandbox = makeSandbox();

	run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	const [line] = curlLines(sandbox);

	assert.ok(line.includes('--proto =https --proto-redir =https'), line);
	assert.ok(line.includes('--connect-timeout 10 --max-time 300 --retry 2 --retry-delay 2 -fsSL'), line);
	assert.ok(line.includes('https://github.com/AlexxIT/go2rtc/releases/download/v9.9.9/'), line);
});

test('refuses a symlinked install directory without downloading or writing through it', () => {
	const sandbox = makeSandbox();
	const target = join(sandbox.root, 'elsewhere');

	mkdirSync(target);
	mkdirSync(join(sandbox.root, 'install'), { recursive: true });
	symlinkSync(target, sandbox.dir);

	const lenient = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);
	const strict = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(lenient.status, 0);
	assert.ok(lenient.stderr.includes('symbolic link'), lenient.stderr);
	assert.equal(strict.status, 1);
	assert.deepEqual(curlLines(sandbox), []);
	assert.deepEqual(readdirSync(target), []);
});

test(
	'refuses an install directory owned by another user without downloading',
	{ skip: process.getuid?.() === 0 ? 'root owns the directory it would be refused for' : false },
	() => {
		const sandbox = makeSandbox();
		// /usr exists, is root-owned and is not a symlink on Linux and macOS; the script refuses before writing.
		const lenient = run(sandbox, ['--arch', 'amd64', '--dir', '/usr']);
		const strict = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', '/usr']);

		assert.equal(lenient.status, 0);
		assert.ok(lenient.stderr.includes('not owned by the current user'), lenient.stderr);
		assert.equal(strict.status, 1);
		assert.deepEqual(curlLines(sandbox), []);
	},
);

test('replaces a symlink at the binary and licence paths instead of writing through it', () => {
	const sandbox = makeSandbox();
	const victim = join(sandbox.root, 'victim-file');
	const victimDir = join(sandbox.root, 'victim-dir');

	mkdirSync(sandbox.dir, { recursive: true });
	mkdirSync(victimDir);
	writeFileSync(victim, 'untouched');
	symlinkSync(victim, join(sandbox.dir, 'go2rtc'));
	symlinkSync(victimDir, join(sandbox.dir, 'LICENSE'));

	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(victim, 'utf8'), 'untouched');
	assert.deepEqual(readdirSync(victimDir), []);
	assert.equal(lstatSync(join(sandbox.dir, 'go2rtc')).isSymbolicLink(), false);
	assert.equal(lstatSync(join(sandbox.dir, 'LICENSE')).isSymbolicLink(), false);
	assert.equal(readFileSync(join(sandbox.dir, 'go2rtc'), 'utf8'), STUB);
	assert.equal(readFileSync(join(sandbox.dir, 'LICENSE'), 'utf8'), REAL_LICENSE);
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['LICENSE', 'go2rtc']);
});

test('sweeps temporary directories left behind by a killed run', () => {
	const sandbox = makeSandbox();
	const stale = join(sandbox.dir, '.install.AbC123');
	const unrelated = join(sandbox.dir, 'keep-me');

	mkdirSync(stale, { recursive: true });
	writeFileSync(join(stale, 'go2rtc'), 'partial download');
	writeFileSync(join(stale, '.owner'), `${deadPid()}\n`);
	writeFileSync(unrelated, 'unrelated');

	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['LICENSE', 'go2rtc', 'keep-me']);
});

test('sweeps stale temporary directories even when the binary is already installed', () => {
	const sandbox = makeSandbox();
	const args = ['--arch', 'amd64', '--dir', sandbox.dir];

	assert.equal(run(sandbox, args).status, 0);
	mkdirSync(join(sandbox.dir, '.install.Zz9'));
	writeFileSync(join(sandbox.dir, '.install.Zz9', '.owner'), `${deadPid()}\n`);

	const second = run(sandbox, args);

	assert.equal(second.status, 0, second.stderr);
	assert.ok(second.stdout.includes('already installed'), second.stdout);
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['LICENSE', 'go2rtc']);
});

test('requests the asset that matches each architecture', () => {
	const expected = {
		arm64: 'go2rtc_linux_arm64',
		arm: 'go2rtc_linux_arm',
		armhf: 'go2rtc_linux_arm',
		aarch64: 'go2rtc_linux_arm64',
		x86_64: 'go2rtc_linux_amd64',
	};

	for (const [arch, asset] of Object.entries(expected)) {
		const sandbox = makeSandbox();
		const result = run(sandbox, ['--arch', arch, '--dir', sandbox.dir]);
		const lines = curlLines(sandbox);

		assert.equal(result.status, 0, `${arch}: ${result.stderr}`);
		assert.equal(lines.length, 1, arch);
		assert.ok(lines[0].endsWith(`/${asset}`), `${arch}: ${lines[0]}`);
	}
});

test('is a no-op when the installed binary already matches the pin', () => {
	const sandbox = makeSandbox();
	const args = ['--arch', 'amd64', '--dir', sandbox.dir];

	assert.equal(run(sandbox, args).status, 0);

	const inode = statSync(join(sandbox.dir, 'go2rtc')).ino;
	const second = run(sandbox, args);

	assert.equal(second.status, 0, second.stderr);
	assert.equal(curlLines(sandbox).length, 1);
	assert.equal(statSync(join(sandbox.dir, 'go2rtc')).ino, inode);
	assert.ok(second.stdout.includes('already installed'), second.stdout);
});

test('replaces a different installed binary and keeps the install directory clean', () => {
	const sandbox = makeSandbox();

	mkdirSync(sandbox.dir, { recursive: true });
	writeFileSync(join(sandbox.dir, 'go2rtc'), 'an older build');

	const inode = statSync(join(sandbox.dir, 'go2rtc')).ino;
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(join(sandbox.dir, 'go2rtc'), 'utf8'), STUB);
	assert.notEqual(statSync(join(sandbox.dir, 'go2rtc')).ino, inode);
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['LICENSE', 'go2rtc']);
});

test('keeps the existing binary and exits 0 on a checksum mismatch', () => {
	const sandbox = makeSandbox();

	// The pin holds the stub's hash, but the server delivers other bytes.
	for (const asset of ASSETS) {
		writeFileSync(join(sandbox.served, asset), '#!/bin/sh\necho tampered\n');
	}

	mkdirSync(sandbox.dir, { recursive: true });
	writeFileSync(join(sandbox.dir, 'go2rtc'), 'an older build');

	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0);
	assert.equal(readFileSync(join(sandbox.dir, 'go2rtc'), 'utf8'), 'an older build');
	assert.ok(result.stderr.includes('go2rtc: warning'), result.stderr);
	assert.ok(result.stderr.includes('checksum mismatch'), result.stderr);
	assert.deepEqual(readdirSync(sandbox.dir), ['go2rtc']);
});

test('exits 1 on a checksum mismatch with --strict', () => {
	const sandbox = makeSandbox();

	for (const asset of ASSETS) {
		writeFileSync(join(sandbox.served, asset), 'tampered');
	}

	const result = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 1);
	assert.ok(result.stderr.includes('checksum mismatch'), result.stderr);
	assert.deepEqual(readdirSync(sandbox.dir), []);
});

test('never exposes a truncated download', () => {
	const sandbox = makeSandbox();

	writeFileSync(join(sandbox.root, 'curl.mode'), 'truncate');

	const fresh = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(fresh.status, 0);
	assert.ok(fresh.stderr.includes('download failed'), fresh.stderr);
	assert.equal(existsSync(join(sandbox.dir, 'go2rtc')), false);
	assert.deepEqual(readdirSync(sandbox.dir), []);

	writeFileSync(join(sandbox.dir, 'go2rtc'), 'an older build');

	const upgrade = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(upgrade.status, 0);
	assert.ok(upgrade.stderr.includes('download failed'), upgrade.stderr);
	assert.equal(readFileSync(join(sandbox.dir, 'go2rtc'), 'utf8'), 'an older build');
	assert.deepEqual(readdirSync(sandbox.dir), ['go2rtc']);
});

test('exits 0 with a warning when the download fails', () => {
	const sandbox = makeSandbox();

	for (const asset of ASSETS) {
		rmSync(join(sandbox.served, asset));
	}

	const lenient = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);
	const strict = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(lenient.status, 0);
	assert.ok(lenient.stderr.includes('download failed'), lenient.stderr);
	assert.equal(strict.status, 1);
	assert.ok(strict.stderr.includes('download failed'), strict.stderr);
	assert.deepEqual(readdirSync(sandbox.dir), []);
});

test('warns and exits 0 when curl is missing', () => {
	const sandbox = makeSandbox({ curl: false });
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0);
	assert.ok(result.stderr.includes('curl is required'), result.stderr);
	assert.equal(existsSync(sandbox.dir), false);
});

test('reports an unsupported architecture without downloading', () => {
	for (const arch of ['i386', 'armv6l', 'riscv64']) {
		const sandbox = makeSandbox();
		const result = run(sandbox, ['--arch', arch, '--dir', sandbox.dir]);

		assert.equal(result.status, 0, arch);
		assert.ok(result.stderr.includes('unsupported architecture'), `${arch}: ${result.stderr}`);
		assert.deepEqual(curlLines(sandbox), [], arch);
		assert.equal(existsSync(sandbox.dir), false, arch);
	}
});

test('treats an ARMv6 board as unsupported even when dpkg reports armhf', () => {
	const sandbox = makeSandbox({ uname: 'armv6l', dpkg: 'armhf' });
	const result = run(sandbox, ['--dir', sandbox.dir]);

	assert.equal(result.status, 0);
	assert.ok(result.stderr.includes('ARMv6'), result.stderr);
	assert.deepEqual(curlLines(sandbox), []);
	assert.equal(existsSync(sandbox.dir), false);
});

test('uses the 32-bit asset on a 32-bit userland with a 64-bit kernel', () => {
	const sandbox = makeSandbox({ uname: 'aarch64', dpkg: 'armhf' });
	const result = run(sandbox, ['--dir', sandbox.dir]);
	const lines = curlLines(sandbox);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(lines.length, 1);
	assert.ok(lines[0].endsWith('/go2rtc_linux_arm'), lines[0]);
	assert.ok(!lines[0].includes('go2rtc_linux_arm64'), lines[0]);
});

test('falls back to uname when dpkg is not available', () => {
	const sandbox = makeSandbox({ uname: 'x86_64' });
	const result = run(sandbox, ['--dir', sandbox.dir]);
	const lines = curlLines(sandbox);

	assert.equal(result.status, 0, result.stderr);
	assert.ok(lines[0].endsWith('/go2rtc_linux_amd64'), lines[0]);
});

test('skips without touching anything for --skip, FB_SKIP_GO2RTC=1 and the marker file', () => {
	const sandbox = makeSandbox();
	const marker = join(sandbox.root, 'go2rtc.skip');

	writeFileSync(marker, '');

	const runs = [
		run(sandbox, ['--skip', '--dir', sandbox.dir]),
		run(sandbox, ['--dir', sandbox.dir], { FB_SKIP_GO2RTC: '1' }),
		run(sandbox, ['--dir', sandbox.dir], { FB_GO2RTC_SKIP_FILE: marker }),
	];

	for (const result of runs) {
		assert.equal(result.status, 0, result.stderr);
		assert.ok(result.stdout.includes('skipped'), result.stdout);
	}

	assert.equal(existsSync(sandbox.dir), false);
	assert.equal(existsSync(sandbox.curlLog), false);
});

test('rejects a malformed pin file', () => {
	const sandbox = makeSandbox();
	const hash = sha256(STUB);
	const withKey = (key, value) =>
		pinContent([hash])
			.split('\n')
			.map((line) => (line.startsWith(`${key}=`) ? `${key}=${value}` : line))
			.join('\n');
	const pwned = join(sandbox.root, 'pwned');
	const malformed = {
		'missing key': pinContent([hash]).replace(/^GO2RTC_SHA256_LINUX_ARM64=.*\n/m, ''),
		'uppercase checksum': withKey('GO2RTC_SHA256_LINUX_AMD64', hash.toUpperCase()),
		'63-char checksum': withKey('GO2RTC_SHA256_LINUX_AMD64', hash.slice(1)),
		'injected version': withKey('GO2RTC_VERSION', '1.9.15;rm'),
		'command substitution': withKey('GO2RTC_SHA256_LINUX_AMD64', `$(touch ${pwned})`),
		'missing file': null,
	};

	for (const [name, content] of Object.entries(malformed)) {
		if (content === null) {
			rmSync(sandbox.pin, { force: true });
		} else {
			writeFileSync(sandbox.pin, content);
		}

		const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

		assert.equal(result.status, 0, name);
		assert.ok(result.stderr.includes('pin'), `${name}: ${result.stderr}`);
		assert.deepEqual(curlLines(sandbox), [], name);
		assert.equal(existsSync(sandbox.dir), false, name);
	}

	assert.equal(existsSync(pwned), false, 'the pin file must never be sourced');
});

test('does not install a binary that cannot run', () => {
	const sandbox = makeSandbox({ binary: script(['exit 126']) });
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0);
	assert.ok(result.stderr.includes('does not run'), result.stderr);
	assert.deepEqual(readdirSync(sandbox.dir), []);
});

test('does not install a binary that reports another version', () => {
	const sandbox = makeSandbox({
		binary: script(['echo "go2rtc version 1.0.0"']),
	});
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0);
	assert.ok(result.stderr.includes('does not run'), result.stderr);
	assert.deepEqual(readdirSync(sandbox.dir), []);
});

test('verifies with shasum when sha256sum is not available', { skip: !findOnPath('shasum') }, () => {
	const sandbox = makeSandbox({ omit: ['sha256sum'] });
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(join(sandbox.dir, 'go2rtc'), 'utf8'), STUB);
});

test('warns and exits 0 when no SHA-256 tool is available', () => {
	const sandbox = makeSandbox({ omit: ['sha256sum', 'shasum'] });
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0);
	assert.ok(result.stderr.includes('sha256sum or shasum is required'), result.stderr);
	assert.deepEqual(curlLines(sandbox), []);
});

test(
	'warns and exits 0 when the install directory cannot be created',
	{
		skip: process.getuid?.() === 0 ? 'root ignores directory permissions' : false,
	},
	() => {
		const sandbox = makeSandbox();
		const readOnly = join(sandbox.root, 'read-only');

		mkdirSync(readOnly);
		chmodSync(readOnly, 0o555);

		try {
			const result = run(sandbox, ['--arch', 'amd64', '--dir', join(readOnly, 'sub', 'go2rtc')]);

			assert.equal(result.status, 0);
			assert.ok(result.stderr.includes('cannot create'), result.stderr);
			assert.deepEqual(curlLines(sandbox), []);
		} finally {
			chmodSync(readOnly, 0o755);
		}
	},
);

test('rejects an unknown option with exit 2', () => {
	const sandbox = makeSandbox();
	const result = run(sandbox, ['--bogus']);

	assert.equal(result.status, 2);
	assert.ok(result.stderr.includes('unknown option: --bogus'), result.stderr);
	assert.ok(result.stderr.includes('Usage:'), result.stderr);
	assert.deepEqual(curlLines(sandbox), []);
});

test('rejects --arch and --dir without a value with exit 2', () => {
	const sandbox = makeSandbox();

	for (const option of ['--arch', '--dir']) {
		const result = run(sandbox, [option]);

		assert.equal(result.status, 2, option);
		assert.ok(result.stderr.includes('requires a value'), `${option}: ${result.stderr}`);
	}
});

test('--help prints the option list and exits 0', () => {
	const sandbox = makeSandbox();
	const result = run(sandbox, ['--help']);

	assert.equal(result.status, 0);

	for (const option of ['--skip', '--strict', '--arch', '--dir', '--help']) {
		assert.ok(result.stdout.includes(option), `${option} missing from: ${result.stdout}`);
	}
});

test('the default install directory matches the cameras module default binary path', () => {
	const expected = '/usr/local/lib/smart-panel/go2rtc/go2rtc';
	const defaultDir = read('build/go2rtc/install-go2rtc.sh').match(/^DEFAULT_DIR=(\S+)$/m);

	assert.ok(defaultDir, 'DEFAULT_DIR not found in install-go2rtc.sh');
	assert.equal(`${defaultDir[1]}/go2rtc`, expected);

	const constantsUrl = new URL('apps/backend/src/modules/cameras/cameras.constants.ts', root);

	if (!existsSync(constantsUrl)) {
		return;
	}

	const constant = readFileSync(constantsUrl, 'utf8').match(/GO2RTC_DEFAULT_BINARY_PATH\s*=\s*'([^']+)'/);

	if (constant) {
		assert.equal(constant[1], expected);
	}
});

const runBoth = (sandbox, dir = sandbox.dir) => ({
	lenient: run(sandbox, ['--arch', 'amd64', '--dir', dir]),
	strict: run(sandbox, ['--strict', '--arch', 'amd64', '--dir', dir]),
});

const assertRefused = (sandbox, results, message) => {
	assert.equal(results.lenient.status, 0, results.lenient.stderr);
	assert.ok(results.lenient.stderr.includes(message), results.lenient.stderr);
	assert.equal(results.strict.status, 1);
	assert.ok(results.strict.stderr.includes(message), results.strict.stderr);
	assert.deepEqual(curlLines(sandbox), []);
};

test('refuses an install directory that is group-writable, without downloading', () => {
	const sandbox = makeSandbox();

	mkdirSync(sandbox.dir, { recursive: true });
	chmodSync(sandbox.dir, 0o775);

	assertRefused(sandbox, runBoth(sandbox), 'writable by its group');
	assert.deepEqual(readdirSync(sandbox.dir), []);
});

test('refuses an install directory that is world-writable, without downloading', () => {
	const sandbox = makeSandbox();

	mkdirSync(sandbox.dir, { recursive: true });
	chmodSync(sandbox.dir, 0o757);

	assertRefused(sandbox, runBoth(sandbox), 'writable by other users');
	assert.deepEqual(readdirSync(sandbox.dir), []);
});

test('refuses an install directory below a group- or world-writable parent before creating anything', () => {
	for (const [parentMode, message] of [
		[0o775, 'writable by its group'],
		[0o777, 'writable by other users'],
		[0o1777, 'writable by other users'],
	]) {
		const sandbox = makeSandbox();
		const parent = join(sandbox.root, 'install');

		mkdirSync(parent);
		chmodSync(parent, parentMode);
		// A deeper level that does not exist yet: the walk must still reach the unsafe ancestor.
		const dir = join(parent, 'new', 'go2rtc');

		assertRefused(sandbox, runBoth(sandbox, dir), message);
		assert.deepEqual(readdirSync(parent), [], parentMode.toString(8));
	}
});

test('refuses an install directory below a writable ancestor that is several levels up', () => {
	const sandbox = makeSandbox();
	const top = join(sandbox.root, 'a');

	mkdirSync(join(top, 'b', 'c'), { recursive: true });
	chmodSync(top, 0o777);

	assertRefused(sandbox, runBoth(sandbox, join(top, 'b', 'c', 'go2rtc')), 'writable by other users');
	assert.deepEqual(readdirSync(join(top, 'b', 'c')), []);
});

test('refuses a parent directory owned by a user other than root or the current one', () => {
	const sandbox = makeSandbox();
	const parent = join(sandbox.root, 'install');
	const realLs = findOnPath('ls');

	mkdirSync(parent);

	// Changing an owner needs root, so a stand-in ls reports the parent as owned by uid 4242.
	writeExecutable(
		join(sandbox.bin, 'ls'),
		script([
			'for last; do :; done',
			`if [ "$last" = '${realpathSync(parent)}' ]; then echo 'drwxr-xr-x 2 4242 4242 64 Jan 1 00:00 x'; exit 0; fi`,
			`exec '${realLs}' "$@"`,
		]),
	);

	assertRefused(sandbox, runBoth(sandbox), 'owned by uid 4242');
	assert.deepEqual(readdirSync(parent), []);
});

test('trusts a group-writable /usr/local only for the root or staff group', { skip: !existsSync('/usr/local') }, () => {
	const realLs = findOnPath('ls');
	const dir = '/usr/local/lib/smart-panel/go2rtc';

	const attempt = (gid) => {
		const sandbox = makeSandbox();

		// /usr/local is reported as root-owned, group-writable and owned by gid; staff is gid 50. A failing mkdir keeps
		// an accepted run from creating anything on the host.
		writeExecutable(
			join(sandbox.bin, 'ls'),
			script([
				'for last; do :; done',
				`if [ "$last" = '${realpathSync('/usr/local')}' ]; then echo 'drwxrwxr-x 2 0 ${gid} 64 Jan 1 00:00 x'; exit 0; fi`,
				`exec '${realLs}' "$@"`,
			]),
		);
		writeExecutable(join(sandbox.bin, 'getent'), script(["echo 'staff:x:50:'"]));
		writeExecutable(join(sandbox.bin, 'mkdir'), script(['exit 1']));

		return { sandbox, result: runBoth(sandbox, dir) };
	};

	for (const gid of [50, 0]) {
		const { sandbox, result } = attempt(gid);

		for (const run of [result.lenient, result.strict]) {
			assert.ok(!run.stderr.includes('writable by its group'), `gid ${gid}: ${run.stderr}`);
		}

		assert.deepEqual(curlLines(sandbox), [], `gid ${gid}`);
	}

	const { sandbox, result } = attempt(100);

	assertRefused(sandbox, result, 'writable by its group');
});

test(
	'refuses a parent directory that is really owned by another user',
	{ skip: process.getuid?.() === 0 ? undefined : 'changing an owner needs root' },
	() => {
		const sandbox = makeSandbox();
		const parent = join(sandbox.root, 'install');

		mkdirSync(parent);
		spawnSync('chown', ['4242', parent]);

		assertRefused(sandbox, runBoth(sandbox), 'owned by uid 4242');
	},
);

test('refuses a relative install directory under an unsafe ancestor and a directory path that is a file', () => {
	const sandbox = makeSandbox();
	const unsafe = join(sandbox.root, 'unsafe');

	mkdirSync(unsafe);
	chmodSync(unsafe, 0o777);

	const relative = spawnSync(SHELL, [SCRIPT, '--arch', 'amd64', '--dir', 'go2rtc'], {
		cwd: unsafe,
		encoding: 'utf8',
		env: {
			PATH: `${sandbox.bin}${delimiter}${sandbox.toolbox}`,
			FB_GO2RTC_PIN_FILE: sandbox.pin,
			FB_GO2RTC_SKIP_FILE: join(sandbox.root, 'no-such-marker'),
		},
	});

	assert.equal(relative.status, 0, relative.stderr);
	assert.ok(relative.stderr.includes('writable by other users'), relative.stderr);
	assert.deepEqual(readdirSync(unsafe), []);

	const file = join(sandbox.root, 'a-file');

	writeFileSync(file, 'not a directory');

	const underFile = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', join(file, 'go2rtc')]);

	assert.equal(underFile.status, 1);
	assert.ok(underFile.stderr.includes('not a directory'), underFile.stderr);
	assert.deepEqual(curlLines(sandbox), []);

	const dotDot = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', `${sandbox.root}/x/../go2rtc`]);

	assert.equal(dotDot.status, 1);
	assert.ok(dotDot.stderr.includes('.. component'), dotDot.stderr);
});

test('accepts a new install directory below a private base directory', () => {
	const sandbox = makeSandbox();
	const result = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', join(sandbox.root, 'x', 'y', 'go2rtc')]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(join(sandbox.root, 'x', 'y', 'go2rtc', 'go2rtc'), 'utf8'), STUB);
});

test('installs into the physical path of a symlinked parent and never re-resolves the symlink', () => {
	const sandbox = makeSandbox();
	const real = join(sandbox.root, 'real');
	const other = join(sandbox.root, 'other');
	const link = join(sandbox.root, 'link');

	mkdirSync(real);
	mkdirSync(other);
	symlinkSync(real, link);
	// The stand-in for an attacker: while the download runs, the validated symlink is pointed somewhere else.
	symlinkSync(other, join(sandbox.root, 'link.next'));
	writeExecutable(
		join(sandbox.bin, 'curl'),
		script([
			`rm '${link}'`,
			`mv '${sandbox.root}/link.next' '${link}'`,
			"out=''",
			'while [ $# -gt 0 ]; do',
			'  case $1 in -o) out=$2; shift ;; esac',
			'  shift',
			'done',
			`cp '${sandbox.served}/go2rtc_linux_amd64' "$out"`,
		]),
	);

	const result = run(sandbox, ['--strict', '--arch', 'amd64', '--dir', join(link, 'new', 'go2rtc')]);
	const installed = join(realpathSync(real), 'new', 'go2rtc');

	assert.equal(result.status, 0, result.stderr);
	assert.equal(realpathSync(link), realpathSync(other), 'the symlink was retargeted during the run');
	assert.equal(readFileSync(join(installed, 'go2rtc'), 'utf8'), STUB);
	assert.equal(readFileSync(join(installed, 'LICENSE'), 'utf8'), REAL_LICENSE);
	assert.deepEqual(readdirSync(installed).sort(), ['LICENSE', 'go2rtc']);
	assert.deepEqual(readdirSync(other), []);
	assert.ok(result.stdout.includes(`installed 9.9.9 (amd64) to ${installed}`), result.stdout);
});

const installedSandbox = () => {
	const sandbox = makeSandbox();

	assert.equal(run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]).status, 0);
	assert.equal(curlLines(sandbox).length, 1);

	return sandbox;
};

test('applies 0755 to an installed binary that already matches the pin, without downloading', () => {
	const sandbox = installedSandbox();

	chmodSync(join(sandbox.dir, 'go2rtc'), 0o644);

	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.ok(result.stdout.includes('already installed'), result.stdout);
	assert.equal(mode(join(sandbox.dir, 'go2rtc')), 0o755);
	assert.equal(curlLines(sandbox).length, 1);
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['LICENSE', 'go2rtc']);
});

test('restores a missing or different LICENSE when the binary already matches the pin, without downloading', () => {
	const sandbox = installedSandbox();
	const license = join(sandbox.dir, 'LICENSE');

	rmSync(license);

	const missing = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(missing.status, 0, missing.stderr);
	assert.equal(readFileSync(license, 'utf8'), REAL_LICENSE);
	assert.equal(mode(license), 0o644);

	writeFileSync(license, 'edited');

	const different = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(different.status, 0, different.stderr);
	assert.equal(readFileSync(license, 'utf8'), REAL_LICENSE);

	chmodSync(license, 0o600);

	const restricted = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(restricted.status, 0, restricted.stderr);
	assert.equal(mode(license), 0o644);
	assert.equal(curlLines(sandbox).length, 1);
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['LICENSE', 'go2rtc']);
});

test('does not chmod through a symlinked binary even when the target matches the pin', () => {
	const sandbox = makeSandbox();
	const victim = join(sandbox.root, 'victim-binary');

	mkdirSync(sandbox.dir, { recursive: true });
	writeFileSync(victim, STUB);
	chmodSync(victim, 0o600);
	symlinkSync(victim, join(sandbox.dir, 'go2rtc'));

	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(mode(victim), 0o600);
	assert.equal(lstatSync(join(sandbox.dir, 'go2rtc')).isSymbolicLink(), false);
	assert.equal(curlLines(sandbox).length, 1);
});

test('refuses to install over a real directory at the binary or licence path', () => {
	for (const name of ['go2rtc', 'LICENSE']) {
		const sandbox = makeSandbox();

		mkdirSync(join(sandbox.dir, name), { recursive: true });
		writeFileSync(join(sandbox.dir, name, 'keep'), 'keep');

		assertRefused(sandbox, runBoth(sandbox), `${join(sandbox.dir, name)} is a directory`);
		assert.deepEqual(readdirSync(join(sandbox.dir, name)), ['keep'], name);
		assert.deepEqual(readdirSync(sandbox.dir), [name], name);
	}
});

const workspace = (sandbox, name, { owner, ageHours = 0 } = {}) => {
	const path = join(sandbox.dir, name);

	mkdirSync(path, { recursive: true });
	writeFileSync(join(path, 'go2rtc'), 'partial download');

	if (owner !== undefined) {
		writeFileSync(join(path, '.owner'), owner);
	}

	if (ageHours > 0) {
		const past = new Date(Date.now() - ageHours * 3600 * 1000);

		utimesSync(path, past, past);
	}

	return path;
};

test('leaves a workspace whose owner process is alive, removes one whose owner is gone', () => {
	const sandbox = makeSandbox();
	const live = workspace(sandbox, '.install.Live01', { owner: `${process.pid}\n` });
	const dead = workspace(sandbox, '.install.Dead01', { owner: `${deadPid()}\n` });
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(existsSync(join(live, 'go2rtc')), true);
	assert.equal(existsSync(dead), false);
	assert.deepEqual(readdirSync(sandbox.dir).sort(), ['.install.Live01', 'LICENSE', 'go2rtc']);
});

test('keeps a recent workspace without an owner file and removes one older than an hour', () => {
	const sandbox = makeSandbox();
	const fresh = workspace(sandbox, '.install.Fresh1');
	const garbage = workspace(sandbox, '.install.Garb01', { owner: 'not-a-pid\n' });
	const old = workspace(sandbox, '.install.Old001', { ageHours: 2 });
	const oldGarbage = workspace(sandbox, '.install.Old002', { owner: '\n', ageHours: 2 });
	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(existsSync(fresh), true);
	assert.equal(existsSync(garbage), true);
	assert.equal(existsSync(old), false);
	assert.equal(existsSync(oldGarbage), false);
});

test('never follows a symlink named like a workspace', () => {
	const sandbox = makeSandbox();
	const target = join(sandbox.root, 'victim-workspace');

	mkdirSync(sandbox.dir, { recursive: true });
	mkdirSync(target);
	writeFileSync(join(target, '.owner'), `${deadPid()}\n`);
	writeFileSync(join(target, 'keep'), 'keep');
	symlinkSync(target, join(sandbox.dir, '.install.Link01'));

	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(readFileSync(join(target, 'keep'), 'utf8'), 'keep');
	assert.equal(lstatSync(join(sandbox.dir, '.install.Link01')).isSymbolicLink(), true);
});

test('records the owning pid in its own workspace and removes the workspace on exit', () => {
	const sandbox = makeSandbox();

	// A slow curl lets the test read the workspace while the installer is still running.
	writeExecutable(
		join(sandbox.bin, 'curl'),
		script([`cp "$(ls -d '${sandbox.dir}'/.install.*)/.owner" '${sandbox.root}/owner.copy'`, 'exit 22']),
	);

	const result = run(sandbox, ['--arch', 'amd64', '--dir', sandbox.dir]);

	assert.equal(result.status, 0, result.stderr);
	assert.match(readFileSync(join(sandbox.root, 'owner.copy'), 'utf8'), /^\d+\n$/);
	assert.deepEqual(readdirSync(sandbox.dir), []);
});
