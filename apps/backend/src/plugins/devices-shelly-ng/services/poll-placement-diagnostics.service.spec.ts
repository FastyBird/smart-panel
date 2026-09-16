import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { PollPlacementDiagnosticsService } from './poll-placement-diagnostics.service';

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
		service.observeCycle(7, 60_000, ['delegate-a', 'delegate-b']);
		service.observeSlot('delegate-a', 7, 'dispatch-attempt');

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
});
