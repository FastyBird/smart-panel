import { ChildProcess, fork, spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { once } from 'events';
import { chmod, copyFile, mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, relative, resolve } from 'path';

import type { PollPlacementDiagnosticsService } from './poll-placement-diagnostics.service';

type Snapshot = NonNullable<PollPlacementDiagnosticsService['snapshot']>;

const support = resolve(__dirname, '../../../../test/support/poll-placement');
const readerPath = process.env.FB_POLL_TEST_READER ?? join(support, 'read.sh');
const selectorPath = process.env.FB_POLL_TEST_SELECTOR ?? join(support, 'select.sh');
const finalizerPath = process.env.FB_POLL_TEST_FINALIZER ?? join(support, 'finalize.cjs');
const sourceDeviceId = '22222222-2222-4222-8222-222222222222';
const delegate = { delegateId: 'target', sourceDeviceId, connected: true, generation: 1 };

describe('poll placement readiness: actual publisher → reader → selector → finalizer', () => {
	let directory: string;
	let exportPath: string;
	let worker: ChildProcess;
	let config: Record<string, unknown>;
	let readSequence = 0;

	const command = async (method?: string, args: unknown[] = [], now?: number): Promise<Snapshot> => {
		const response = once(worker, 'message');
		worker.send({ method, args, now });
		const [value] = (await response) as [{ snapshot: Snapshot; error?: string }];
		if (value.error) throw new Error(String(value.error));
		return value.snapshot;
	};
	const start = async (overrides: Record<string, unknown> = {}) => {
		config = { schemaVersion: 2, runId: randomUUID(), sourceDeviceId, exportPath, durationMs: 360000, ...overrides };
		await writeFile(join(directory, 'config.json'), JSON.stringify(config), { mode: 0o600 });
		worker = fork(join(support, 'worker.cjs'), [], {
			cwd: resolve(support, '../../..'),
			execArgv: ['-r', 'ts-node/register/transpile-only'],
			env: { ...process.env, FB_SHELLY_POLL_PLACEMENT: JSON.stringify(config) },
			stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
		});
		return command();
	};
	const stop = async () => {
		if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;
		const exited = once(worker, 'exit');
		await command('onModuleDestroy');
		await exited;
	};
	const cycle = async (now: number, order = ['other', 'target'], decision = 'dispatch-attempt', generation = 4) => {
		let snapshot = await command('observeCycle', [generation, 60000, order], now);
		const id = snapshot.observations.at(-1).cycleSequence;
		await command('completeCycleRegistration', [id], now + 1);
		snapshot = await command('observeSlot', ['target', generation, id, decision], now + 30000);
		return snapshot;
	};
	const select = async (now: number) => {
		const snapshot = JSON.parse(await readFile(exportPath, 'utf8')) as Snapshot;
		const before = new Date(Date.UTC(2026, 0, 1) + now).toISOString();
		const freshness = {
			schemaVersion: 1,
			source: 'paired-backend-anchor',
			backendClock: 'performance-now-v1',
			processId: snapshot.processId,
			processInstanceId: snapshot.processInstanceId,
			processIdentityBefore: `local:${snapshot.processId}`,
			processIdentityAfter: `local:${snapshot.processId}`,
			anchorMonotonicMs: snapshot.armedAtMonotonicMs,
			anchorUtc: snapshot.armedAtUtc,
			readUtcBefore: before,
			readUtcAfter: before,
			backendMonotonicMs: now,
			uncertaintyMs: 1,
		};
		const freshnessPath = join(directory, 'freshness.json');
		await writeFile(freshnessPath, JSON.stringify(freshness), { mode: 0o600 });
		const output = join(directory, `result-${++readSequence}.json`);
		const result = spawnSync(
			'bash',
			[readerPath, exportPath, `${exportPath}.owner.json`, join(directory, 'config.json'), freshnessPath, output],
			{ env: { ...process.env, FB_COMMAND_LATENCY_SELECTOR: selectorPath }, encoding: 'utf8' },
		);
		return {
			status: result.status,
			output: JSON.parse(await readFile(output, 'utf8')) as { state: string; reason?: string },
		};
	};
	const retainOwner = () => copyFile(`${exportPath}.owner.json`, join(directory, 'retained-owner.json'));
	const finalize = () =>
		spawnSync(process.execPath, [finalizerPath, exportPath, join(directory, 'retained-owner.json')], {
			encoding: 'utf8',
		});

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'poll-readiness-'));
		await chmod(directory, 0o700);
		exportPath = join(directory, 'snapshot.json');
	});
	afterEach(async () => {
		await stop();
		await rm(directory, { recursive: true, force: true });
	});

	it('waits past the old expiry, preserves preparation, selects a future window and cleans only after writer exit', async () => {
		const initial = await start();
		expect(initial).toMatchObject({ status: 'preparing', armedAtMonotonicMs: null, expiresAtMonotonicMs: null });
		expect((await select(2000)).output.reason).toBe('snapshot-preparing');
		await command('observeDelegate', [delegate], 370000);
		await cycle(370000);
		const ready = await cycle(430000);
		expect(ready).toMatchObject({ status: 'ready', armedAtMonotonicMs: 460000, expiresAtMonotonicMs: 820000 });
		expect(ready.preparation).toMatchObject({
			createdAtMonotonicMs: 1000,
			deadlineMonotonicMs: 601000,
			activationCycles: [1, 2],
		});
		expect(ready.observations.map((entry) => entry.phase)).toEqual(['preparation', 'preparation']);
		expect(await select(460001)).toMatchObject({ status: 0, output: { state: 'selectable' } });
		await retainOwner();
		expect(finalize().stderr).toContain('writer-still-running');
		const later = await cycle(490000);
		expect(later.armedAtMonotonicMs).toBe(460000);
		expect(later.expiresAtMonotonicMs).toBe(820000);
		expect(later.observations.at(-1).phase).toBe('measurement');
		await stop();
		expect(finalize().status).toBe(0);
		await expect(readFile(exportPath)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each([resolve(support, '../../..'), support])('runs both adapters using relative paths from %s', async (cwd) => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await cycle(70000);
		await select(100001);
		const env: NodeJS.ProcessEnv = {
			...process.env,
			NOW_MONOTONIC_MS: '100001',
			NOW_UNCERTAINTY_MS: '1',
			DISPATCH_ALLOWANCE_MS: '1000',
		};
		delete env.FB_COMMAND_LATENCY_SELECTOR;
		for (const name of ['read', 'select']) {
			const output = join(directory, `relative-${name}.json`);
			const args =
				name === 'read'
					? [
							exportPath,
							`${exportPath}.owner.json`,
							join(directory, 'config.json'),
							join(directory, 'freshness.json'),
							output,
						]
					: [exportPath, join(directory, 'config.json'), output];
			const result = spawnSync('bash', [relative(cwd, join(support, `${name}.sh`)), ...args], {
				cwd,
				env,
				encoding: 'utf8',
			});
			expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
			expect((JSON.parse(await readFile(output, 'utf8')) as { state: string }).state).toBe('selectable');
		}
	});

	it('never arms an unresolved target and expires preparation without a scheduler callback', async () => {
		await start();
		await cycle(10000, ['other']);
		const expired = await command('isEnabled', [], 601000);
		expect(expired).toMatchObject({ status: 'expired', reason: 'preparation-expired', armedAtMonotonicMs: null });
		await command('observeDelegate', [delegate]);
		expect((await command('observeCycle', [4, 60000, ['target']], 602000)).armedAtMonotonicMs).toBeNull();
		expect((await select(602001)).status).toBe(1);
	});

	it('rejects future measurement cycles and decisions, including the clock uncertainty boundary', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await cycle(70000);
		await cycle(130000);
		await cycle(190000);
		expect((await select(180000)).output.reason).toBe('observation-in-future');
		for (const now of [200000, 220000, 220000.5]) {
			expect(await select(now)).toMatchObject({ status: 1, output: { reason: 'decision-in-future' } });
		}
		expect(await select(220001)).toMatchObject({ status: 0, output: { state: 'selectable' } });
	});

	it('rejects a future v1 slot without inventing an observed decision timestamp', async () => {
		await start({ schemaVersion: 1 });
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await cycle(70000);
		expect((await select(90000)).output.reason).toBe('decision-in-future');
		expect((await select(100000)).output.reason).toBe('decision-in-future');
		expect((await select(100001)).status).toBe(0);
	});

	it.each(['anchor', 'registration'])(
		'rejects %s UTC drift despite locally consistent registration bounds',
		async (field) => {
			await start();
			await command('observeDelegate', [delegate]);
			await cycle(10000);
			await cycle(70000);
			await cycle(130000);
			const snapshot = await cycle(190000);
			const last = snapshot.observations.at(-1);
			const shift = (utc: string) => new Date(Date.parse(utc) + 3000).toISOString();
			if (field === 'anchor') {
				last.anchorUtc = shift(last.anchorUtc);
			} else {
				last.target.registrationBeforeUtc = shift(last.target.registrationBeforeUtc);
				last.target.registrationAfterUtc = shift(last.target.registrationAfterUtc);
			}
			await writeFile(exportPath, JSON.stringify(snapshot));
			expect((await select(220001)).output.reason).toBe('observation-clock-mismatch');
		},
	);

	it('rejects future registration completion even when its duration agrees in both clocks', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await cycle(70000);
		await cycle(130000);
		const snapshot = await cycle(190000);
		const target = snapshot.observations.at(-1).target;
		target.registrationAfterMs = 230000;
		target.registrationAfterUtc = new Date(Date.UTC(2026, 0, 1) + 230000).toISOString();
		await writeFile(exportPath, JSON.stringify(snapshot));
		expect((await select(220001)).output.reason).toBe('observation-in-future');
	});

	it('does not activate across changed order, an empty cycle or a skipped slot', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		expect((await cycle(70000, ['target', 'other'])).status).toBe('preparing');
		await cycle(130000, []);
		expect((await cycle(190000, ['target', 'other'])).status).toBe('preparing');
		await cycle(250000, ['target', 'other'], 'skipped');
		expect((await cycle(310000, ['target', 'other'])).status).toBe('preparing');
		expect((await cycle(370000, ['target', 'other'])).status).toBe('ready');
	});

	it('rejects late decisions from a detached attachment even when its identifier and generation are reused', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await command('observeCycle', [4, 60000, ['other', 'target']], 70000);
		await command('completeCycleRegistration', [2], 70001);
		await command('removeDelegate', ['target'], 71000);
		await command('observeDelegate', [delegate], 72000);
		expect((await command('observeSlot', ['target', 4, 2, 'dispatch-attempt'], 100000)).status).toBe('preparing');
		expect((await cycle(130000)).status).toBe('preparing');
		expect((await cycle(190000)).status).toBe('ready');
	});

	it('does not renew the active deadline after detach or later cycles', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		const ready = await cycle(70000);
		await command('removeDelegate', ['target'], 101000);
		expect((await select(101001)).status).toBe(1);
		await command('observeDelegate', [{ ...delegate, generation: 2 }], 102000);
		await cycle(130000);
		expect((await select(160001)).status).toBe(1);
		await cycle(190000);
		expect((await select(220001)).status).toBe(0);
		const expired = await command('observeCycle', [4, 60000, ['target']], ready.expiresAtMonotonicMs);
		expect(expired).toMatchObject({
			status: 'expired',
			armedAtMonotonicMs: ready.armedAtMonotonicMs,
			expiresAtMonotonicMs: ready.expiresAtMonotonicMs,
		});
		expect((await select(ready.expiresAtMonotonicMs)).status).toBe(1);
	});

	it('refuses a restarted writer at the same path and rejects mismatched owner provenance', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await cycle(70000);
		await retainOwner();
		const owner = JSON.parse(await readFile(`${exportPath}.owner.json`, 'utf8')) as { processId: number };
		await writeFile(`${exportPath}.owner.json`, JSON.stringify({ ...owner, processId: owner.processId + 1 }));
		expect((await select(100001)).output.reason).toBe('owner-process-mismatch');
		await stop();
		expect(finalize().stderr).toContain('owner-mismatch');
		const restarted = await start();
		expect(restarted).toMatchObject({ status: 'writer-failure', reason: 'export-ownership-failed' });
		expect((await command('observeCycle', [4, 60000, ['target']], 10000)).status).toBe('writer-failure');
	});

	it('fails closed on writer failure and preserves a foreign export during finalization', async () => {
		await start();
		await retainOwner();
		await chmod(directory, 0o755);
		const failed = await command('observeCycle', [4, 60000, ['target']], 10000);
		expect(failed.status).toBe('writer-failure');
		expect((await select(10001)).status).toBe(1);
		await stop();
		await chmod(directory, 0o700);
		await writeFile(exportPath, JSON.stringify({ runId: 'foreign' }), { mode: 0o600 });
		expect(finalize().stderr).toContain('export-owner-mismatch');
		expect((JSON.parse(await readFile(exportPath, 'utf8')) as { runId: string }).runId).toBe('foreign');
	});

	it('can finalize an owned missing export after writer exit, and refuses a missing owner', async () => {
		await start();
		await retainOwner();
		await stop();
		await rm(exportPath);
		expect(finalize().status).toBe(0);
		expect(finalize().status).toBe(1);
	});

	it.each([999, 600001, '600000'])('rejects an invalid preparation bound: %s', async (preparationMs) => {
		expect(await start({ preparationMs })).toBeNull();
	});

	it('expires from its preparation timer without another observer method call', async () => {
		await start({ preparationMs: 1000 });
		await command(undefined, [], 2000);
		await new Promise((resolve) => setTimeout(resolve, 1100));
		expect(await command()).toMatchObject({ status: 'expired', reason: 'preparation-expired' });
	});

	it('rejects mutated configuration and a fabricated activation pair in the actual reader', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await cycle(70000);
		await writeFile(join(directory, 'config.json'), JSON.stringify({ ...config, preparationMs: 599000 }));
		expect((await select(100001)).status).toBe(1);
		await writeFile(join(directory, 'config.json'), JSON.stringify(config));
		const snapshot = JSON.parse(await readFile(exportPath, 'utf8')) as Snapshot;
		snapshot.preparation.activationCycles = [2, 3];
		await writeFile(exportPath, JSON.stringify(snapshot));
		expect((await select(100001)).output.reason).toBe('activation-evidence-invalid');
	});

	it('requires completed registration and both observed decisions in the same generation', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		expect((await cycle(70000, ['other', 'target'], 'dispatch-attempt', 5)).status).toBe('preparing');
		await command('observeCycle', [5, 60000, ['other', 'target']], 130000);
		expect((await command('observeSlot', ['target', 5, 3, 'dispatch-attempt'], 160000)).status).toBe('preparing');
		const ready = await command('completeCycleRegistration', [3], 160001);
		expect(ready.status).toBe('ready');
		expect(ready.preparation.activationCycles).toEqual([2, 3]);
		expect((await command('completeCycleRegistration', [3], 160002)).armedAtMonotonicMs).toBe(160001);
	});

	it('rejects a missing export in the reader and preserves a symlink during cleanup', async () => {
		await start();
		await command('observeDelegate', [delegate]);
		await cycle(10000);
		await cycle(70000);
		await select(100001);
		await retainOwner();
		await stop();
		await rm(exportPath);
		const missing = spawnSync('bash', [
			readerPath,
			exportPath,
			`${exportPath}.owner.json`,
			join(directory, 'config.json'),
			join(directory, 'freshness.json'),
			join(directory, 'missing-result.json'),
		]);
		expect(missing.status).toBe(1);
		const foreign = join(directory, 'foreign.json');
		await writeFile(foreign, 'foreign', { mode: 0o600 });
		await symlink(foreign, exportPath);
		expect(finalize().stderr).toContain('foreign-or-public-file');
		expect(await readFile(foreign, 'utf8')).toBe('foreign');
	});

	it('enforces the shared observation bound during preparation', async () => {
		await start();
		for (let i = 1; i <= 65; i++) await command('observeCycle', [4, 10, []], 1000 + i * 10);
		const snapshot = await command();
		expect(snapshot.status).toBe('overflow');
		expect(snapshot.observations).toHaveLength(64);
		expect(snapshot.armedAtMonotonicMs).toBeNull();
	});
});
