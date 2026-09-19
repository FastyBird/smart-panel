/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { createHash, randomUUID } from 'crypto';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { PollPlacementDiagnosticsService } from './poll-placement-diagnostics.service';

const uniqueExportPath = (name: string): string => join(tmpdir(), `${name}-${randomUUID()}.json`);

describe('PollPlacementDiagnosticsService', () => {
	const originalConfig = process.env.FB_SHELLY_POLL_PLACEMENT;

	afterEach(() => {
		if (originalConfig === undefined) delete process.env.FB_SHELLY_POLL_PLACEMENT;
		else process.env.FB_SHELLY_POLL_PLACEMENT = originalConfig;
	});

	it('is disabled for absent or malformed configuration', () => {
		delete process.env.FB_SHELLY_POLL_PLACEMENT;
		expect(new PollPlacementDiagnosticsService().isEnabled()).toBe(false);

		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({ schemaVersion: 1, runId: 'not-a-uuid' });
		expect(new PollPlacementDiagnosticsService().isEnabled()).toBe(false);
	});

	it('uses the three-minute default and accepts the bounded six-minute diagnostic', async () => {
		const defaultDirectory = await mkdtemp(join(tmpdir(), 'poll-placement-default-'));
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath: join(defaultDirectory, 'snapshot.json'),
		});
		const defaultService = new PollPlacementDiagnosticsService();
		expect(
			(defaultService as any).snapshot.expiresAtMonotonicMs - (defaultService as any).snapshot.armedAtMonotonicMs,
		).toBe(180_000);
		await defaultService.onModuleDestroy();
		await rm(defaultDirectory, { recursive: true, force: true });

		const extendedDirectory = await mkdtemp(join(tmpdir(), 'poll-placement-extended-'));
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath: join(extendedDirectory, 'snapshot.json'),
			durationMs: 360_000,
		});
		const extendedService = new PollPlacementDiagnosticsService();
		expect(extendedService.isEnabled()).toBe(true);
		expect(
			(extendedService as any).snapshot.expiresAtMonotonicMs - (extendedService as any).snapshot.armedAtMonotonicMs,
		).toBe(360_000);
		await extendedService.onModuleDestroy();
		await rm(extendedDirectory, { recursive: true, force: true });
	});

	it.each([999, 360_001])('rejects duration outside the bounded diagnostic range: %s ms', (durationMs) => {
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath: uniqueExportPath('poll-placement-duration'),
			durationMs,
		});
		expect(new PollPlacementDiagnosticsService().isEnabled()).toBe(false);
	});

	it('retains a bounded ready snapshot for the actual sorted delegate cycle', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'poll-placement-'));
		const exportPath = join(directory, 'snapshot.json');
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath,
			durationMs: 10_000,
		});

		const service = new PollPlacementDiagnosticsService();
		service.observeDelegate({
			delegateId: 'delegate-a',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			connected: true,
			generation: 3,
		});
		const cycleSequence = service.observeCycle(7, 60_000, ['delegate-a', 'delegate-b']);
		if (cycleSequence === null) throw new Error('cycle was not observed');
		service.completeCycleRegistration(cycleSequence);
		service.observeSlot('delegate-a', 7, cycleSequence, 'dispatch-attempt');

		for (let attempt = 0; attempt < 20; attempt++) {
			try {
				const snapshot = JSON.parse(await readFile(exportPath, 'utf8')) as {
					status: string;
					observations: { connectedDelegateCount: number; target: { decision: string } }[];
				};
				expect(snapshot.status).toBe('ready');
				expect(snapshot.observations[0].connectedDelegateCount).toBe(2);
				expect(snapshot.observations[0].target.decision).toBe('dispatch-attempt');
				await rm(directory, { recursive: true, force: true });
				return;
			} catch {
				await new Promise((resolve) => setTimeout(resolve, 5));
			}
		}

		await rm(directory, { recursive: true, force: true });
		throw new Error('diagnostic snapshot was not published');
	});

	it('associates slot decisions with their cycle and records bounded registration timestamps', () => {
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath: uniqueExportPath('poll-placement-cycle'),
		});
		const service = new PollPlacementDiagnosticsService();
		service.observeDelegate({
			delegateId: 'delegate-a',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			connected: true,
			generation: 1,
		});
		const first = service.observeCycle(1, 60_000, ['delegate-a']);
		if (first === null) throw new Error('first cycle was not observed');
		service.completeCycleRegistration(first);
		const second = service.observeCycle(1, 60_000, ['delegate-a']);
		if (second === null) throw new Error('second cycle was not observed');
		service.observeSlot('delegate-a', 1, first, 'dispatch-attempt');

		const snapshot = (service as any).snapshot;
		expect(snapshot.observations[0].target.decision).toBe('dispatch-attempt');
		expect(snapshot.observations[1].target.decision).toBe('unresolved');
		expect(snapshot.observations[0].target.registrationAfterMs).not.toBeNull();
		expect(snapshot.observations[0].target.registrationAfterUtc).toEqual(expect.any(String));
		expect(snapshot.observations[0].activePollCount).toBe(0);
		expect(snapshot.observations[0].targetInFlight).toBe(false);
		expect(second).not.toBe(first);
	});

	it('invalidates only when the observed target is removed or replaced', () => {
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath: uniqueExportPath('poll-placement-invalidation'),
		});
		const service = new PollPlacementDiagnosticsService();
		service.observeDelegate({
			delegateId: 'other',
			sourceDeviceId: '33333333-3333-4333-8333-333333333333',
			connected: true,
			generation: 1,
		});
		service.observeCycle(1, 60_000, ['other']);
		expect((service as any).snapshot.status).toBe('ready');
		service.removeDelegate('other');
		expect((service as any).snapshot.status).toBe('ready');

		service.observeDelegate({
			delegateId: 'target',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			connected: true,
			generation: 1,
		});
		service.removeDelegate('target');
		expect((service as any).snapshot.status).toBe('ready');
		expect((service as any).snapshot.candidateStatus).toBe('invalidated');
		service.observeDelegate({
			delegateId: 'target',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			connected: true,
			generation: 2,
		});
		const cycle = service.observeCycle(1, 60_000, ['target']);
		expect(cycle).not.toBeNull();
		expect((service as any).snapshot.candidateStatus).toBe('valid');
	});

	it('fails closed for expired sessions even without another scheduler callback', () => {
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath: uniqueExportPath('poll-placement-expiry'),
			durationMs: 1_000,
		});
		const service = new PollPlacementDiagnosticsService();
		(service as any).snapshot.expiresAtMonotonicMs = (service as any).now() - 1;
		expect(service.isEnabled()).toBe(false);
		expect((service as any).snapshot.status).toBe('expired');
	});

	it('binds provenance to the running observer artifact', () => {
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath: uniqueExportPath('poll-placement-provenance'),
		});
		const service = new PollPlacementDiagnosticsService();
		expect((service as any).snapshot.observerRuntimeHash).not.toBe(
			createHash('sha256').update('poll-placement-diagnostics-v1').digest('hex'),
		);
	});

	it('refuses to overwrite a pre-existing export', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'poll-placement-foreign-'));
		const exportPath = join(directory, 'snapshot.json');
		const foreignSnapshot = '{"runId":"foreign"}\n';
		await writeFile(exportPath, foreignSnapshot, { mode: 0o600 });
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath,
		});
		const service = new PollPlacementDiagnosticsService();
		await (service as any).writePromise;
		expect((service as any).snapshot.status).toBe('writer-failure');
		expect(await readFile(exportPath, 'utf8')).toBe(foreignSnapshot);
		await service.onModuleDestroy();
		await rm(directory, { recursive: true, force: true });
	});

	it('persists an exclusive owner record and waits for final shutdown publication', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'poll-placement-owner-'));
		const exportPath = join(directory, 'snapshot.json');
		process.env.FB_SHELLY_POLL_PLACEMENT = JSON.stringify({
			schemaVersion: 1,
			runId: '11111111-1111-4111-8111-111111111111',
			sourceDeviceId: '22222222-2222-4222-8222-222222222222',
			exportPath,
		});
		const service = new PollPlacementDiagnosticsService();
		await (service as any).writePromise;
		const owner = JSON.parse(await readFile(`${exportPath}.owner.json`, 'utf8')) as {
			runId: string;
			processInstanceId: string;
			configFingerprint: string;
		};
		expect(owner.runId).toBe('11111111-1111-4111-8111-111111111111');
		expect(owner.processInstanceId).toBe((service as any).snapshot.processInstanceId);
		expect(owner.configFingerprint).toBe((service as any).snapshot.configFingerprint);

		await service.onModuleDestroy();
		const finalSnapshot = JSON.parse(await readFile(exportPath, 'utf8')) as { status: string; reason: string };
		expect(finalSnapshot).toMatchObject({ status: 'invalidated', reason: 'process-shutdown' });
		await rm(directory, { recursive: true, force: true });
	});
});
