import { execFileSync } from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
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
const SQLITE = execFileSync('which', ['sqlite3'], { encoding: 'utf8' }).trim();

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
	managerProcesses: string;
	databaseDir: string;
	database: string;
	installedWorker: string;
	targetWorkerSha256: string;
	archiveSha256: string;
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
	const managerProcesses = join(root, 'manager-processes');
	const databaseDir = join(root, 'database');
	const database = join(databaseDir, 'database.sqlite');
	const installedWorker = join(root, 'alpha12-installed-update-worker.sh');

	mkdirSync(bin);
	mkdirSync(imageBase);
	mkdirSync(cgroupDir);
	mkdirSync(databaseDir);
	mkdirSync(join(processRoot, '999'), { recursive: true });
	mkdirSync(join(processRoot, '1'), { recursive: true });
	mkdirSync(join(imageBase, 'v1.1.0-alpha.12'), { recursive: true });
	mkdirSync(join(archiveRoot, 'dist'), { recursive: true });
	mkdirSync(join(archiveRoot, 'node_modules', 'typeorm'), { recursive: true });
	writeFileSync(join(archiveRoot, 'dist', 'dataSource.js'), 'module.exports = {};\n');
	writeFileSync(join(archiveRoot, 'node_modules', 'typeorm', 'cli.js'), 'fixture cli\n');
	mkdirSync(join(archiveRoot, 'dist', 'modules', 'system', 'scripts'), { recursive: true });
	writeFileSync(join(archiveRoot, 'dist', 'modules', 'system', 'scripts', 'update-worker.sh'), readFileSync(WORKER));
	writeFileSync(managerProcesses, '{"type":"a(sus)","data":[[]]}');
	writeFileSync(cgroupProcs, '999\n');
	writeFileSync(cgroupEvents, 'populated 1\n');
	writeFileSync(join(processRoot, '999', 'identity'), 'fixture-main-process');
	writeFileSync(join(processRoot, '1', 'identity'), 'fixture-systemd-manager');
	writeFileSync(join(root, 'boot-id'), 'fixture-boot-id');
	writeFileSync(stateFile, 'active');
	execFileSync(SQLITE, [database, 'CREATE TABLE IF NOT EXISTS fixture_seed (id INTEGER PRIMARY KEY)']);
	copyFileSync(WORKER, installedWorker);
	chmodSync(installedWorker, 0o700);
	symlinkSync('v1.1.0-alpha.12', join(imageBase, 'current'));

	execFileSync('tar', ['-czf', archive, '-C', archiveRoot, '.']);

	writeExecutable(
		join(bin, 'sudo'),
		`#!/bin/bash
if [ "$1" = "-n" ] && [ "$2" = "-l" ]; then exit 0; fi
[ "$1" = "-n" ] && shift
if [ "$1" = "ln" ] && [ "\${ACTIVATE_AFTER_SWITCH:-false}" = true ]; then
  "$@" || exit $?
  printf active > "$SERVICE_STATE_FILE"
  exit 0
fi
exec "$@"
`,
	);
	writeExecutable(
		join(bin, 'curl'),
		`#!/bin/bash
output=""
url="$*"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then output="$2"; shift 2; continue; fi
  shift
done
if [[ "$url" == *"/api/v1/modules/system/system/health"* ]]; then
  if [ "\${HEALTH_RESULT:-success}" = "failure" ]; then exit 17; fi
  if [ "\${HEALTH_RESULT:-success}" = "malformed" ]; then printf 'not-json\\n'; exit 0; fi
  printf '{"data":{"status":"ok","version":"%s"}}\\n' "\${HEALTH_RESPONSE_VERSION:-\${HEALTH_EXPECTED_VERSION:-1.1.0-alpha.15}}"
  exit 0
fi
if [ "\${CREATE_BACKUP_DURING_RUN:-false}" = true ]; then printf 'created during run' > "\${DB_BACKUP_PATH}"; fi
cp "$FIXTURE_ARCHIVE" "$output"
`,
	);
	writeExecutable(
		join(bin, 'node'),
		`#!/bin/bash
	if [ -n "\${CGROUP_PROBE_PATH:-}" ] || [ -n "\${CGROUP_FILE_PATH:-}" ] || [ -n "\${MANAGER_REPLY:-}" ]; then exec ${process.execPath} "$@"; fi
	if [ "$1" = "-e" ]; then
		case "\${2:-}" in
			*HEALTH_EXPECTED_VERSION*) ;;
			*) exit 0 ;;
		esac
		[ "\${HEALTH_RESULT:-success}" = "failure" ] && exit 17
		[ "\${HEALTH_RESULT:-success}" = "malformed" ] && exit 17
		[ "\${HEALTH_RESPONSE_VERSION:-\${HEALTH_EXPECTED_VERSION:-1.1.0-alpha.15}}" = "\${HEALTH_EXPECTED_VERSION:-1.1.0-alpha.15}" ] || exit 1
		exit 0
	fi
	if [ "\${MIGRATION_RESULT:-success}" = "failure" ]; then echo 'fixture migration failed' >&2; exit 17; fi
	exit 0
`,
	);
	writeExecutable(
		join(bin, 'busctl'),
		`#!/bin/bash
case " $* " in
  *" GetUnitProcesses "*)
    [ "\${BUSCTL_RESULT:-success}" = success ] || exit 17
    [ -r "$SERVICE_MANAGER_PROCS_FILE" ] || exit 17
    cat "$SERVICE_MANAGER_PROCS_FILE"
    ;;
  *" GetUnit "*)
    [ "\${BUSCTL_RESULT:-success}" = success ] || exit 17
    printf '{"type":"o","data":["/org/freedesktop/systemd1/unit/smart_2dpanel_2eservice"]}\\n'
    ;;
  *) exit 17 ;;
esac
`,
	);
	writeExecutable(join(bin, 'chown'), '#!/bin/bash\nexit 0\n');
	writeExecutable(
		join(bin, 'sqlite3'),
		`#!/bin/bash
backup_path="$(printf '%s' "$2" | sed "s/^\\.backup '//; s/'$//")"
if [ "\${SQLITE_RESULT:-success}" = failure ]; then printf 'partial backup' > "$backup_path"; exit 17; fi
if [ "\${SQLITE_RESULT:-success}" = empty ]; then : > "$backup_path"; exit 0; fi
if [ "\${SQLITE_RESULT:-success}" = race ]; then
	${SQLITE} "$@"
	result=$?
	printf 'created during sqlite backup' > "\${DB_BACKUP_PATH}"
	exit "$result"
fi
if [ "\${ACTIVATE_AFTER_BACKUP:-false}" = true ]; then
  ${SQLITE} "$@" || exit $?
  printf active > "$SERVICE_STATE_FILE"
  exit 0
fi
if [ -n "\${IDENTITY_CHANGE_AFTER_BACKUP:-}" ]; then
  ${SQLITE} "$@" || exit $?
  case "$IDENTITY_CHANGE_AFTER_BACKUP" in
    boot) printf 'replacement-boot' > "$SERVICE_BOOT_ID_FILE";;
    manager) printf 'replacement-manager' > "$SERVICE_PROCESS_ROOT/1/identity";;
    cgroup)
      rm -rf "$SERVICE_CGROUP_DIR"
      mkdir "$SERVICE_CGROUP_DIR"
      : > "$SERVICE_CGROUP_PROCS_FILE"
      printf 'populated 0\n' > "$SERVICE_CGROUP_EVENTS_FILE"
      ;;
  esac
  exit 0
fi
exec ${SQLITE} "$@"
`,
	);
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
  if [ "$property" = "\${PROPERTY_READ_ERROR:-}" ]; then exit 17; fi
  state="$(cat "$SERVICE_STATE_FILE")"
			case "$property" in
				ActiveState) printf '%s\\n' "$state";;
				MainPID) [ "$state" = active ] && printf '999\\n' || printf '0\\n';;
				ControlPID) printf '0\\n';;
				ControlGroup) printf '%s\\n' "\${CONTROL_GROUP_VALUE:-/system.slice/smart-panel.service}";;
				Job) [ "\${JOB_RESULT:-empty}" = pending ] && printf '123\\n';;
				FragmentPath) printf '/etc/systemd/system/smart-panel.service\\n';;
				ExecStart) printf '%s/current/dist/main.js\\n' "$IMAGE_BASE_DIR";;
				Id) printf '%s\\n' "$SERVICE_UNIT";;
				LoadState) printf 'loaded\\n';;
				Slice) printf '%s\\n' "\${SLICE_VALUE:-system.slice}";;
				Delegate) printf '%s\\n' "\${DELEGATE_VALUE:-no}";;
				KillMode) printf '%s\\n' "\${KILL_MODE_VALUE:-process}";;
				InvocationID) printf 'fixture-invocation\\n';;
				Result) printf 'success\\n';;
				ExecMainStartTimestampMonotonic) printf '1\\n';;
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
		managerProcesses,
		databaseDir,
		database,
		installedWorker,
		targetWorkerSha256: execFileSync('sha256sum', [WORKER], { encoding: 'utf8' }).split(/\s+/)[0],
		archiveSha256: execFileSync('sha256sum', [archive], { encoding: 'utf8' }).split(/\s+/)[0],
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
		SERVICE_CGROUP_MOUNT: fixture.root,
		SERVICE_PROCESS_ROOT: fixture.processRoot,
		SERVICE_BOOT_ID_FILE: join(fixture.root, 'boot-id'),
		SERVICE_STATE_FILE: fixture.stateFile,
		SERVICE_UNIT: 'smart-panel.service',
		SERVICE_MANAGER_PROCS_FILE: fixture.managerProcesses,
		SERVICE_CGROUP_MOUNT_TYPE: 'cgroup2fs',
		FB_DB_PATH: fixture.databaseDir,
		FIXTURE_ARCHIVE: fixture.archive,
		DOWNLOAD_URL: 'fixture://alpha15',
		HEALTH_URL: 'http://127.0.0.1:3000/api/v1/modules/system/system/health',
		HEALTH_EXPECTED_VERSION: '1.1.0-alpha.15',
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

function stoppedMaintenanceEnv(fixture: Fixture, overrides: Record<string, string> = {}): Record<string, string> {
	return {
		UPDATE_START_MODE: 'stopped-maintenance',
		EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
		TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
		TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
		EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
		EXPECTED_STATUS_FILE: fixture.statusFile,
		EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
		EXPECTED_DB_PATH: fixture.databaseDir,
		DB_BACKUP_PATH: join(fixture.root, 'backup.sqlite'),
		...overrides,
	};
}

jest.setTimeout(30_000);

describe('legacy image update worker lifecycle', () => {
	it('runs a verified stopped-maintenance update without starting the old release', async () => {
		const fixture = createFixture();
		const backup = join(fixture.root, 'backup.sqlite');
		const source = new DataSource({ type: 'sqlite', database: fixture.database });
		let backupSource: DataSource | undefined;

		try {
			await source.initialize();
			await source.query('PRAGMA journal_mode = WAL');
			await source.query('PRAGMA wal_autocheckpoint = 0');
			await source.query('CREATE TABLE maintenance_fixture (id integer primary key, value text not null)');
			await source.query("INSERT INTO maintenance_fixture (value) VALUES ('committed in WAL')");
			expect(existsSync(`${fixture.database}-wal`)).toBe(true);
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');

			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256.toUpperCase(),
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256.toUpperCase(),
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: backup,
			});
			const status = readJson(fixture.statusFile);
			expect(result.status).toBe('success');
			expect(status.status).toBe('complete');
			expect(existsSync(backup)).toBe(true);
			backupSource = new DataSource({ type: 'sqlite', database: backup });
			await backupSource.initialize();
			expect(await backupSource.query('SELECT value FROM maintenance_fixture')).toEqual([
				{ value: 'committed in WAL' },
			]);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toContain('v1.1.0-alpha.15');
			expect(readFileSync(fixture.stateFile, 'utf8')).toBe('active');
		} finally {
			if (backupSource?.isInitialized) await backupSource.destroy();
			if (source.isInitialized) await source.destroy();
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects an existing stopped-maintenance backup before downloading or extracting', () => {
		const fixture = createFixture();
		const backup = join(fixture.root, 'backup.sqlite');

		try {
			writeFileSync(backup, 'existing backup');
			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: backup,
			});
			expect(result.status).not.toBe('success');
			expect(readJson(fixture.statusFile)).toMatchObject({
				status: 'failed',
				error: 'Stopped maintenance backup path already exists',
			});
			expect(existsSync(fixture.attemptDir)).toBe(false);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it.each(['missing', 'symlinked', 'empty'] as const)(
		'rejects a %s stopped-maintenance source database before downloading',
		(sourceState) => {
			const fixture = createFixture();
			const backup = join(fixture.root, 'backup.sqlite');

			try {
				rmSync(fixture.database, { force: true });
				if (sourceState === 'symlinked') {
					writeFileSync(join(fixture.root, 'alternate.sqlite'), 'alternate source');
					symlinkSync(join(fixture.root, 'alternate.sqlite'), fixture.database);
				} else if (sourceState === 'empty') {
					writeFileSync(fixture.database, '');
				}

				const result = runWorker(fixture, {
					UPDATE_START_MODE: 'stopped-maintenance',
					EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
					TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
					TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
					EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
					EXPECTED_STATUS_FILE: fixture.statusFile,
					EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
					EXPECTED_DB_PATH: fixture.databaseDir,
					DB_BACKUP_PATH: backup,
				});

				expect(result.status).not.toBe('success');
				expect(readJson(fixture.statusFile)).toMatchObject({
					status: 'failed',
					error: 'Stopped maintenance source database is missing, symlinked, or empty',
				});
				expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
			} finally {
				rmSync(fixture.root, { recursive: true, force: true });
			}
		},
	);

	it('rejects a backup path created during the run before SQLite can overwrite it', () => {
		const fixture = createFixture();
		const backup = join(fixture.root, 'backup.sqlite');

		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				CREATE_BACKUP_DURING_RUN: 'true',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: backup,
			});
			expect(result.status).not.toBe('success');
			expect(readJson(fixture.statusFile)).toMatchObject({
				status: 'failed',
				error: 'Stopped maintenance backup path was created during the run',
			});
			expect(readFileSync(backup, 'utf8')).toBe('created during run');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('publishes the temporary SQLite backup without replacing a concurrent destination', () => {
		const fixture = createFixture();
		const backup = join(fixture.root, 'backup.sqlite');

		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				SQLITE_RESULT: 'race',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: backup,
			});

			expect(result.status).not.toBe('success');
			expect(readJson(fixture.statusFile)).toMatchObject({
				status: 'failed',
				error: 'Stopped maintenance backup path was created during the run',
			});
			expect(readFileSync(backup, 'utf8')).toBe('created during sqlite backup');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it.each([
		['after backup, before switch', 'ACTIVATE_AFTER_BACKUP', 'v1.1.0-alpha.12'],
		['after switch, before migration entry', 'ACTIVATE_AFTER_SWITCH', 'v1.1.0-alpha.15'],
	] as const)('holds an activation %s without entering SQL', (_phase, activationFlag, expectedLink) => {
		const fixture = createFixture();
		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			const result = runWorker(fixture, stoppedMaintenanceEnv(fixture, { [activationFlag]: 'true' }));
			expect(result.status).not.toBe('success');
			expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
				state: 'recovery_required',
				migrationEntered: false,
			});
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toContain(expectedLink);
			expect(readdirSync(fixture.attemptDir).some((name) => name.endsWith('.migration.log'))).toBe(false);
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects a failed manager command before download and SQL', () => {
		const fixture = createFixture();
		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			const result = runWorker(fixture, stoppedMaintenanceEnv(fixture, { BUSCTL_RESULT: 'failure' }));
			expect(result.status).not.toBe('success');
			expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
				state: 'recovery_required',
				migrationEntered: false,
			});
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it.each(['boot', 'manager', 'cgroup'] as const)(
		'holds a changed %s identity after backup without switch or SQL',
		(identity) => {
			const fixture = createFixture();
			try {
				writeFileSync(fixture.stateFile, 'inactive');
				rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
				writeFileSync(fixture.cgroupProcs, '');
				writeFileSync(fixture.cgroupEvents, 'populated 0\n');
				const result = runWorker(fixture, stoppedMaintenanceEnv(fixture, { IDENTITY_CHANGE_AFTER_BACKUP: identity }));
				expect(result.status).not.toBe('success');
				expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
					state: 'recovery_required',
					migrationEntered: false,
				});
				expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
				expect(readdirSync(fixture.attemptDir).some((name) => name.endsWith('.migration.log'))).toBe(false);
			} finally {
				rmSync(fixture.root, { recursive: true, force: true });
			}
		},
	);

	it.each([
		['failure', 'Consistent SQLite backup failed'],
		['empty', 'Consistent SQLite backup is empty'],
	] as const)('cleans up a %s SQLite backup failure before recording the preflight error', (sqliteResult, error) => {
		const fixture = createFixture();
		const backup = join(fixture.root, 'backup.sqlite');

		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				SQLITE_RESULT: sqliteResult,
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: backup,
			});

			expect(result.status).not.toBe('success');
			expect(readJson(fixture.statusFile)).toMatchObject({ status: 'failed', error });
			expect(existsSync(backup)).toBe(false);
			expect(readdirSync(fixture.root).filter((name) => name.startsWith('backup.sqlite'))).toEqual([]);
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('cleans up the extracted release when the SQLite backup directory cannot be created', () => {
		const fixture = createFixture();
		const backupParent = join(fixture.root, 'backup-parent');
		const backup = join(backupParent, 'backup.sqlite');

		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			writeFileSync(backupParent, 'not a directory');
			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: backup,
			});

			expect(result.status).not.toBe('success');
			expect(readJson(fixture.statusFile)).toMatchObject({
				status: 'failed',
				error: 'Could not create SQLite backup directory',
			});
			expect(readFileSync(backupParent, 'utf8')).toBe('not a directory');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('accepts a removed stopped-service cgroup after independent checks prove it empty', async () => {
		const fixture = createFixture();
		const backup = join(fixture.root, 'backup.sqlite');
		const source = new DataSource({ type: 'sqlite', database: fixture.database });

		try {
			await source.initialize();
			await source.query('CREATE TABLE maintenance_fixture (id integer primary key)');
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			rmSync(fixture.cgroupDir, { recursive: true, force: true });

			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: backup,
				SERVICE_CGROUP_MOUNT: fixture.root,
			});

			expect(result.status).toBe('success');
			expect(readJson(fixture.statusFile).status).toBe('complete');
		} finally {
			if (source.isInitialized) await source.destroy();
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('fails closed when stopped-maintenance manager enumeration reports a process', () => {
		const fixture = createFixture();

		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			writeFileSync(fixture.managerProcesses, '{"type":"a(sus)","data":[[["smart-panel.service",123,"node"]]]}');

			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: join(fixture.root, 'backup.sqlite'),
			});
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it.each([
		['blank', ''],
		['malformed text', 'a(sus) nope'],
		['wrong signature', '{"type":"as","data":[[]]}'],
		['truncated tuple', '{"type":"a(sus)","data":[[["smart-panel.service",123]]]}'],
		['overflow PID', '{"type":"a(sus)","data":[[["smart-panel.service",4294967296,"node"]]]}'],
	])('rejects a %s successful manager reply before download and SQL', (_caseName, output) => {
		const fixture = createFixture();
		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			writeFileSync(fixture.managerProcesses, output);
			const result = runWorker(fixture, stoppedMaintenanceEnv(fixture));
			expect(result.status).not.toBe('success');
			expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
				state: 'recovery_required',
				migrationEntered: false,
			});
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it.each(['FragmentPath', 'ExecStart', 'Slice', 'Delegate', 'KillMode', 'InvocationID', 'Result', 'ControlGroup'])(
		'rejects a failed %s property read before download and SQL',
		(property) => {
			const fixture = createFixture();
			try {
				writeFileSync(fixture.stateFile, 'inactive');
				rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
				writeFileSync(fixture.cgroupProcs, '');
				writeFileSync(fixture.cgroupEvents, 'populated 0\n');
				const result = runWorker(fixture, stoppedMaintenanceEnv(fixture, { PROPERTY_READ_ERROR: property }));
				expect(result.status).not.toBe('success');
				expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
					state: 'recovery_required',
					migrationEntered: false,
				});
				expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
				expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
			} finally {
				rmSync(fixture.root, { recursive: true, force: true });
			}
		},
	);

	it.each([
		['wrong cgroup path', { CONTROL_GROUP_VALUE: '/system.slice/other.service' }],
		['wrong slice', { SLICE_VALUE: 'other.slice' }],
		['delegated unit', { DELEGATE_VALUE: 'yes' }],
		['unsupported kill mode', { KILL_MODE_VALUE: 'none' }],
	] as const)('rejects a %s before download and SQL', (_caseName, overrides) => {
		const fixture = createFixture();
		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');
			const result = runWorker(fixture, stoppedMaintenanceEnv(fixture, overrides));
			expect(result.status).not.toBe('success');
			expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
				state: 'recovery_required',
				migrationEntered: false,
			});
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it('rejects a dangling cgroup directory symlink instead of treating it as removed', () => {
		const fixture = createFixture();
		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			rmSync(fixture.cgroupDir, { recursive: true });
			symlinkSync(join(fixture.root, 'missing-cgroup'), fixture.cgroupDir);
			const result = runWorker(fixture, stoppedMaintenanceEnv(fixture));
			expect(result.status).not.toBe('success');
			expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
				state: 'recovery_required',
				migrationEntered: false,
			});
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
			expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it.each(['membership symlink', 'descendant symlink', 'nondirectory parent'] as const)(
		'rejects a %s as unavailable cgroup evidence',
		(cgroupFault) => {
			const fixture = createFixture();
			try {
				writeFileSync(fixture.stateFile, 'inactive');
				rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
				writeFileSync(fixture.cgroupProcs, '');
				writeFileSync(fixture.cgroupEvents, 'populated 0\n');
				const overrides: Record<string, string> = {};
				if (cgroupFault === 'membership symlink') {
					writeFileSync(join(fixture.root, 'empty-members'), '');
					rmSync(fixture.cgroupProcs);
					symlinkSync(join(fixture.root, 'empty-members'), fixture.cgroupProcs);
				} else if (cgroupFault === 'descendant symlink') {
					symlinkSync(join(fixture.root, 'elsewhere'), join(fixture.cgroupDir, 'child'));
				} else {
					writeFileSync(join(fixture.root, 'not-a-directory'), 'file');
					overrides.SERVICE_CGROUP_DIR = join(fixture.root, 'not-a-directory', 'cgroup');
					overrides.SERVICE_CGROUP_PROCS_FILE = join(overrides.SERVICE_CGROUP_DIR, 'cgroup.procs');
				}
				const result = runWorker(fixture, stoppedMaintenanceEnv(fixture, overrides));
				expect(result.status).not.toBe('success');
				expect(readJson(join(fixture.attemptDir, 'attempt.json'))).toMatchObject({
					state: 'recovery_required',
					migrationEntered: false,
				});
				expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
				expect(existsSync(join(fixture.imageBase, 'v1.1.0-alpha.15'))).toBe(false);
			} finally {
				rmSync(fixture.root, { recursive: true, force: true });
			}
		},
	);

	it('fails closed when stopped-maintenance has a pending systemd job', () => {
		const fixture = createFixture();

		try {
			writeFileSync(fixture.stateFile, 'inactive');
			rmSync(join(fixture.processRoot, '999'), { recursive: true, force: true });
			writeFileSync(fixture.cgroupProcs, '');
			writeFileSync(fixture.cgroupEvents, 'populated 0\n');

			const result = runWorker(fixture, {
				UPDATE_START_MODE: 'stopped-maintenance',
				JOB_RESULT: 'pending',
				EXPECTED_CURRENT_VERSION: '1.1.0-alpha.12',
				TARGET_ARCHIVE_SHA256: fixture.archiveSha256,
				TARGET_WORKER_SHA256: fixture.targetWorkerSha256,
				EXPECTED_IMAGE_BASE_DIR: fixture.imageBase,
				EXPECTED_STATUS_FILE: fixture.statusFile,
				EXPECTED_ATTEMPT_DIR: fixture.attemptDir,
				EXPECTED_DB_PATH: fixture.databaseDir,
				DB_BACKUP_PATH: join(fixture.root, 'backup.sqlite'),
			});

			expect(result.status).not.toBe('success');
			expect(readJson(join(fixture.attemptDir, 'attempt.json')).state).toBe('recovery_required');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

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

	it('rejects an image update before mutation when the local health URL is missing', () => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, { HEALTH_URL: '' });
			const status = readJson(fixture.statusFile);

			expect(result.status).not.toBe('success');
			expect(status.error).toBe('No local health URL configured for image update');
			expect(existsSync(join(fixture.attemptDir, 'attempt.json'))).toBe(false);
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toBe('v1.1.0-alpha.12');
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it.each([
		['wrong target version', { HEALTH_RESPONSE_VERSION: '1.1.0-alpha.99' }],
		['malformed payload', { HEALTH_RESULT: 'malformed' }],
	])('holds the target when health validation rejects a %s', (_label, overrides) => {
		const fixture = createFixture();

		try {
			const result = runWorker(fixture, overrides);
			const attempt = readJson(join(fixture.attemptDir, 'attempt.json'));

			expect(result.status).not.toBe('success');
			expect(attempt.state).toBe('recovery_required');
			expect(attempt.phase).toBe('start_failed');
			expect(readlinkSync(join(fixture.imageBase, 'current'))).toContain('v1.1.0-alpha.15');
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
