import { execFileSync } from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readlinkSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const WORKER = join(__dirname, 'update-worker.sh');

interface Fixture {
	root: string;
	bin: string;
	imageBase: string;
	statusFile: string;
	attemptDir: string;
	cgroupDir: string;
	cgroupProcs: string;
	cgroupEvents: string;
	processRoot: string;
	archive: string;
	stateFile: string;
	installedWorker: string;
}

function writeExecutable(path: string, contents: string): void {
	writeFileSync(path, contents, { mode: 0o700 });
	chmodSync(path, 0o700);
}

function createFixture(): Fixture {
	const root = mkdtempSync(join(tmpdir(), 'smart-panel-update-worker-'));
	const bin = join(root, 'bin');
	const imageBase = join(root, 'images');
	const statusFile = join(root, 'update-status.json');
	const attemptDir = join(root, 'update-attempt');
	const cgroupDir = join(root, 'cgroup');
	const cgroupProcs = join(cgroupDir, 'cgroup.procs');
	const cgroupEvents = join(cgroupDir, 'cgroup.events');
	const processRoot = join(root, 'proc');
	const archiveRoot = join(root, 'archive');
	const archive = join(root, 'alpha15.tar.gz');
	const stateFile = join(root, 'service-state');
	const installedWorker = join(root, 'alpha12-installed-update-worker.sh');

	mkdirSync(bin);
	mkdirSync(imageBase);
	mkdirSync(cgroupDir);
	mkdirSync(join(processRoot, '999'), { recursive: true });
	mkdirSync(join(imageBase, 'v1.1.0-alpha.12'), { recursive: true });
	mkdirSync(join(archiveRoot, 'dist'), { recursive: true });
	mkdirSync(join(archiveRoot, 'node_modules', 'typeorm'), { recursive: true });
	writeFileSync(join(archiveRoot, 'dist', 'dataSource.js'), 'module.exports = {};\n');
	writeFileSync(join(archiveRoot, 'node_modules', 'typeorm', 'cli.js'), 'fixture cli\n');
	writeFileSync(cgroupProcs, '999\n');
	writeFileSync(cgroupEvents, 'populated 1\n');
	writeFileSync(join(processRoot, '999', 'identity'), 'fixture-main-process');
	writeFileSync(stateFile, 'active');
	copyFileSync(WORKER, installedWorker);
	chmodSync(installedWorker, 0o700);
	symlinkSync('v1.1.0-alpha.12', join(imageBase, 'current'));

	execFileSync('tar', ['-czf', archive, '-C', archiveRoot, '.']);

	writeExecutable(
		join(bin, 'sudo'),
		`#!/bin/bash
if [ "$1" = "-n" ] && [ "$2" = "-l" ]; then exit 0; fi
[ "$1" = "-n" ] && shift
exec "$@"
`,
	);
	writeExecutable(
		join(bin, 'curl'),
		`#!/bin/bash
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then output="$2"; shift 2; continue; fi
  shift
done
cp "$FIXTURE_ARCHIVE" "$output"
`,
	);
	writeExecutable(
		join(bin, 'node'),
		`#!/bin/bash
	if [ "\${MIGRATION_RESULT:-success}" = "failure" ]; then echo 'fixture migration failed' >&2; exit 17; fi
	exit 0
`,
	);
	writeExecutable(join(bin, 'chown'), '#!/bin/bash\nexit 0\n');
	writeExecutable(
		join(bin, 'systemctl'),
		`#!/bin/bash
unit="$2"
if [ "$1" = "stop" ]; then
  if [ "\${STOP_RESULT:-success}" = "failure" ]; then exit 17; fi
  if [ "\${STOP_RESULT:-success}" = "lying" ]; then
    printf active > "$SERVICE_STATE_FILE"
    printf '123\\n' > "$SERVICE_CGROUP_PROCS_FILE"
    exit 0
  fi
  if [ "\${STOP_RESULT:-success}" = "removed-live" ]; then
    printf inactive > "$SERVICE_STATE_FILE"
    rm -rf "$SERVICE_CGROUP_DIR"
    exit 0
  fi
  if [ "\${STOP_RESULT:-success}" = "read-error" ]; then
    printf inactive > "$SERVICE_STATE_FILE"
    rm -rf "$SERVICE_PROCESS_ROOT/999"
    rm -f "$SERVICE_CGROUP_PROCS_FILE"
    mkdir "$SERVICE_CGROUP_PROCS_FILE"
    printf 'populated 0\\n' > "$SERVICE_CGROUP_EVENTS_FILE"
    exit 0
  fi
  if [ "\${STOP_RESULT:-success}" = "missing-membership" ]; then
    printf inactive > "$SERVICE_STATE_FILE"
    rm -rf "$SERVICE_PROCESS_ROOT/999"
    rm -f "$SERVICE_CGROUP_PROCS_FILE"
    printf 'populated 0\\n' > "$SERVICE_CGROUP_EVENTS_FILE"
    exit 0
  fi
  if [ "\${STOP_RESULT:-success}" = "populated-child" ]; then
    printf inactive > "$SERVICE_STATE_FILE"
    rm -rf "$SERVICE_PROCESS_ROOT/999"
    : > "$SERVICE_CGROUP_PROCS_FILE"
    printf 'populated 1\\n' > "$SERVICE_CGROUP_EVENTS_FILE"
    exit 0
  fi
  if [ "\${STOP_RESULT:-success}" = "malformed-membership" ]; then
    printf inactive > "$SERVICE_STATE_FILE"
    rm -rf "$SERVICE_PROCESS_ROOT/999"
    printf 'not-a-pid\\n' > "$SERVICE_CGROUP_PROCS_FILE"
    printf 'populated 0\\n' > "$SERVICE_CGROUP_EVENTS_FILE"
    exit 0
  fi
  if [ "\${STOP_RESULT:-success}" = "removed" ]; then
    printf inactive > "$SERVICE_STATE_FILE"
    rm -rf "$SERVICE_PROCESS_ROOT/999"
    rm -rf "$SERVICE_CGROUP_DIR"
    exit 0
  fi
  printf inactive > "$SERVICE_STATE_FILE"
  rm -rf "$SERVICE_PROCESS_ROOT/999"
  : > "$SERVICE_CGROUP_PROCS_FILE"
  printf 'populated 0\\n' > "$SERVICE_CGROUP_EVENTS_FILE"
  exit 0
fi
if [ "$1" = "start" ]; then
  if [ "\${START_RESULT:-success}" = "failure" ]; then exit 17; fi
  printf active > "$SERVICE_STATE_FILE"
  mkdir -p "$SERVICE_CGROUP_DIR"
  mkdir -p "$SERVICE_PROCESS_ROOT/999"
  printf 'fixture-main-process' > "$SERVICE_PROCESS_ROOT/999/identity"
  printf '999\\n' > "$SERVICE_CGROUP_PROCS_FILE"
  printf 'populated 1\\n' > "$SERVICE_CGROUP_EVENTS_FILE"
  exit 0
fi
if [ "$1" = "show" ]; then
  property=""
  for argument in "$@"; do case "$argument" in --property=*) property="\${argument#--property=}";; esac; done
  state="$(cat "$SERVICE_STATE_FILE")"
  case "$property" in
    ActiveState) printf '%s\\n' "$state";;
    MainPID) [ "$state" = active ] && printf '999\\n' || printf '0\\n';;
    ControlPID) printf '0\\n';;
    ControlGroup) printf '/fixture\\n';;
  esac
  exit 0
fi
exit 1
`,
	);

	return {
		root,
		bin,
		imageBase,
		statusFile,
		attemptDir,
		cgroupDir,
		cgroupProcs,
		cgroupEvents,
		processRoot,
		archive,
		stateFile,
		installedWorker,
	};
}

function runWorker(fixture: Fixture, overrides: Record<string, string> = {}): { status: string; output: string } {
	const env = {
		...process.env,
		PATH: `${fixture.bin}:${process.env.PATH ?? ''}`,
		INSTALL_TYPE: 'image',
		IMAGE_BASE_DIR: fixture.imageBase,
		STATUS_FILE: fixture.statusFile,
		ATTEMPT_DIR: fixture.attemptDir,
		SERVICE_CGROUP_DIR: fixture.cgroupDir,
		SERVICE_CGROUP_PROCS_FILE: fixture.cgroupProcs,
		SERVICE_CGROUP_EVENTS_FILE: fixture.cgroupEvents,
		SERVICE_PROCESS_ROOT: fixture.processRoot,
		SERVICE_STATE_FILE: fixture.stateFile,
		FIXTURE_ARCHIVE: fixture.archive,
		DOWNLOAD_URL: 'fixture://alpha15',
		QUIESCENCE_TIMEOUT_SECONDS: '2',
		START_TIMEOUT_SECONDS: '2',
		...overrides,
	};

	if (overrides.REAL_NODE === 'true') {
		rmSync(join(fixture.bin, 'node'), { force: true });
	}

	try {
		const output = execFileSync('bash', [fixture.installedWorker, '1.1.0-alpha.15'], {
			env,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		return { status: 'success', output };
	} catch (error) {
		const result = error as { stdout?: string; stderr?: string; status?: number };

		return { status: String(result.status ?? 'unknown'), output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
	}
}

function createRealCliArchive(fixture: Fixture): { archive: string; database: string } {
	const archiveRoot = join(fixture.root, 'real-cli-archive');
	const archive = join(fixture.root, 'real-cli-alpha15.tar.gz');
	const database = join(fixture.root, 'real-cli.sqlite');
	mkdirSync(join(archiveRoot, 'dist'), { recursive: true });
	mkdirSync(join(archiveRoot, 'node_modules', 'typeorm'), { recursive: true });
	writeFileSync(
		join(archiveRoot, 'dist', 'dataSource.js'),
		`const { DataSource } = require('typeorm');
class CreateUpdateWorkerFixture1700000000001 {
  async up(queryRunner) { await queryRunner.query('CREATE TABLE "update_worker_fixture" ("id" integer primary key)'); }
  async down(queryRunner) { await queryRunner.query('DROP TABLE "update_worker_fixture"'); }
}
module.exports = new DataSource({ type: 'sqlite', database: process.env.FB_DB_PATH, migrations: [CreateUpdateWorkerFixture1700000000001], migrationsTransactionMode: 'each' });
`,
	);
	writeFileSync(join(archiveRoot, 'node_modules', 'typeorm', 'cli.js'), 'require(process.env.TYPEORM_CLI);\n');
	execFileSync('tar', ['-czf', archive, '-C', archiveRoot, '.']);

	return { archive, database };
}

function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('legacy image update worker lifecycle', () => {
	it('bootstraps the repaired worker into alpha.12 and records a clean completed attempt', () => {
		const fixture = createFixture();

		try {
			expect(readFileSync(fixture.installedWorker)).toEqual(readFileSync(WORKER));
			const result = runWorker(fixture);
			const status = readJson(fixture.statusFile);
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).toBe('success');
			expect(status.status).toBe('complete');
			expect(attempt.state).toBe('complete');
			expect(existsSync(join(fixture.attemptDir, 'lock'))).toBe(false);
			expect(statSync(fixture.attemptDir).mode & 0o777).toBe(0o700);
			expect(statSync(join(fixture.attemptDir, 'attempt.json')).mode & 0o777).toBe(0o600);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toContain('v1.1.0-alpha.15');
			expect(readFileSync(fixture.stateFile, 'utf8')).toBe('active');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('fails closed when stop returns nonzero and preserves an unresolved hold', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'failure' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.recoveryRequired).toBe(true);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('fails closed when stop reports success but a service writer remains', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'lying' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('stopping');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('accepts a removed original cgroup after independent process checks prove it empty', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'removed' });
			const status = readJson(fixture.statusFile);

			expect(result.status).toBe('success');
			expect(status.status).toBe('complete');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toContain('v1.1.0-alpha.15');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects a removed original cgroup when a captured process identity survives', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'removed-live' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('stopping');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('fails closed when the retained cgroup membership read errors', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'read-error' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.recoveryRequired).toBe(true);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('fails closed when the original cgroup remains but its membership file is missing', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'missing-membership' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('stopping');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('fails closed when the retained cgroup subtree is populated despite an empty parent membership file', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'populated-child' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('stopping');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('fails closed when the retained cgroup membership is malformed', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { STOP_RESULT: 'malformed-membership' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('stopping');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects a previously unresolved attempt before downloading or switching builds', () => {
		const fixture = createFixture();

		try {
			mkdirSync(fixture.attemptDir, { recursive: true });
			mkdirSync(join(fixture.attemptDir, 'lock'));
			writeFileSync(
				join(fixture.attemptDir, 'attempt.json'),
				JSON.stringify({ state: 'recovery_required', recoveryRequired: true, phase: 'migration_failed' }),
			);

			const result = runWorker(fixture);

			expect(result.status).not.toBe('success');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('holds the target after migration failure instead of automatic rollback', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { MIGRATION_RESULT: 'failure' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));
			const currentTarget = readlinkSync(join(fixture.imageBase, 'current'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('migration_failed');
			if (typeof attempt.migrationLog !== 'string') {
				throw new Error('migration log path was not retained');
			}
			expect(readFileSync(attempt.migrationLog, 'utf8')).toContain('fixture migration failed');
			expect(currentTarget).toContain('v1.1.0-alpha.15');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(true);
			expect(readFileSync(fixture.stateFile, 'utf8')).toBe('inactive');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('holds the target when the post-migration start fails', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { START_RESULT: 'failure' });
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('start_failed');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toContain('v1.1.0-alpha.15');
			expect(readFileSync(fixture.stateFile, 'utf8')).toBe('inactive');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('runs the target CLI against real SQLite through the installed worker boundary', async () => {
		const fixture = createFixture();
		const target = createRealCliArchive(fixture);

		try {
			const result = runWorker(fixture, {
				FIXTURE_ARCHIVE: target.archive,
				REAL_NODE: 'true',
				FB_DB_PATH: target.database,
				NODE_PATH: join(__dirname, '../../../..', 'node_modules'),
				TYPEORM_CLI: join(__dirname, '../../../..', 'node_modules/typeorm/cli.js'),
			});

			expect(result.status).toBe('success');

			const dataSource = new DataSource({ type: 'sqlite', database: target.database });
			await dataSource.initialize();
			try {
				expect(
					await dataSource.query(
						`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'update_worker_fixture'`,
					),
				).toEqual([{ name: 'update_worker_fixture' }]);
				expect(await dataSource.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
			} finally {
				await dataSource.destroy();
			}
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	}, 15_000);
});
