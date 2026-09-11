import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';

import {
	CommandLatencyTraceCollectorService,
	CommandLatencyTraceConfig,
} from './command-latency-trace-collector.service';

describe('CommandLatencyTraceCollectorService', () => {
	const config: CommandLatencyTraceConfig = {
		runId: 'validation-run',
		sourcePropertyId: 'source-property',
		projectionPropertyId: 'projection-property',
		sourceDeviceId: 'source-device',
	};

	const sourceProperty = (value: boolean): ChannelPropertyEntity => {
		const property = new ChannelPropertyEntity();
		property.id = config.sourcePropertyId;
		property.value = new PropertyValueState(value);

		return property;
	};

	const arm = (collector: CommandLatencyTraceCollectorService, requestId = 'request-1', intentId = 'intent-1') => {
		collector.observeCommand({
			requestId,
			intentId,
			properties: [{ property: config.projectionPropertyId, value: true }],
		});
		collector.bindWindow(intentId, config.sourcePropertyId, 'generation-1');
	};

	it('is disabled by default and does not allocate captures for ordinary commands', async () => {
		const collector = new CommandLatencyTraceCollectorService();
		collector.observeCommand({
			requestId: 'request-1',
			intentId: 'intent-1',
			properties: [{ property: 'projection-property', value: true }],
		});
		await collector.traceUpdate(
			{ propertyId: 'source-property', value: true, windowGeneration: 'generation-1' },
			async () => {
				await Promise.resolve();
				collector.recordSourcePublication(sourceProperty(true));
			},
		);

		expect(collector.isEnabled()).toBe(false);
		expect(collector.getCaptures()).toEqual([]);
	});

	it('rejects invalid duration and record bounds instead of silently widening capture limits', () => {
		expect(new CommandLatencyTraceCollectorService({ ...config, captureDurationMs: 30_001 }).isEnabled()).toBe(false);
		expect(new CommandLatencyTraceCollectorService({ ...config, maxRecords: 4_097 }).isEnabled()).toBe(false);
	});

	it('retains the server-only span through awaits and emits one complete invocation capture', async () => {
		const collector = new CommandLatencyTraceCollectorService(config);
		arm(collector);
		collector.recordPollRpc('source-device', 'poll-rpc-start', { timeoutMs: 10_000 });
		collector.recordPollRpc('source-device', 'poll-rpc-complete', { ok: true });

		await collector.traceUpdate(
			{ propertyId: config.sourcePropertyId, value: true, windowGeneration: 'generation-1' },
			async () => {
				await Promise.resolve();
				collector.recordWriteComplete(sourceProperty(true), { changed: true });
				collector.recordSourcePublication(sourceProperty(true));
			},
		);

		const [capture] = collector.getCaptures();
		expect(capture).toMatchObject({
			clock: 'backend-performance-now-v1',
			runId: 'validation-run',
			trialId: 'request-1',
			intentId: 'intent-1',
			windowGeneration: 'generation-1',
			status: 'complete',
		});
		expect(capture?.invocationId).toEqual(expect.any(String));
		expect(capture?.records.map((record) => record.stage)).toEqual([
			'command-received',
			'window-bound',
			'poll-rpc-start',
			'poll-rpc-complete',
			'update-entry',
			'write-complete',
			'source-publication',
			'update-complete',
		]);
		expect(capture?.records.filter((record) => record.invocationId === capture.invocationId)).toHaveLength(4);
	});

	it('keeps a held stale provider report diagnostic-only and permits its later confirmation', async () => {
		const collector = new CommandLatencyTraceCollectorService(config);
		arm(collector);

		await collector.traceUpdate(
			{ propertyId: config.sourcePropertyId, value: false, windowGeneration: 'generation-1' },
			async () => {
				await Promise.resolve();
				collector.recordWriteComplete(sourceProperty(false), { changed: false, held: true });
				collector.recordSuppressed(sourceProperty(false), 'held by command window');
			},
		);
		await collector.traceUpdate(
			{ propertyId: config.sourcePropertyId, value: true, windowGeneration: 'generation-1' },
			async () => {
				await Promise.resolve();
				collector.recordWriteComplete(sourceProperty(true), { changed: true });
				collector.recordSourcePublication(sourceProperty(true));
			},
		);

		expect(collector.getCaptures().map((capture) => capture.status)).toEqual(['suppressed', 'complete']);
	});

	it('invalidates rather than overwriting a concurrent same-value update', async () => {
		const collector = new CommandLatencyTraceCollectorService(config);
		arm(collector);
		let releaseFirst!: () => void;
		const first = collector.traceUpdate(
			{ propertyId: config.sourcePropertyId, value: true, windowGeneration: 'generation-1' },
			async () => {
				await new Promise<void>((resolve) => (releaseFirst = resolve));
				collector.recordSourcePublication(sourceProperty(true));
			},
		);

		await Promise.resolve();
		await collector.traceUpdate(
			{ propertyId: config.sourcePropertyId, value: true, windowGeneration: 'generation-1' },
			async () => {
				await Promise.resolve();
			},
		);
		releaseFirst();
		await first;

		const [capture] = collector.getCaptures();
		expect(capture?.status).toBe('error');
		expect(capture?.failureReason).toContain('Concurrent provider updates');
	});

	it('invalidates an armed capture at its configured bounded expiry', () => {
		jest.useFakeTimers();
		try {
			const captureDurationMs = 1_500;
			const collector = new CommandLatencyTraceCollectorService({ ...config, captureDurationMs });
			arm(collector);
			jest.advanceTimersByTime(captureDurationMs);

			const [capture] = collector.getCaptures();
			expect(capture?.status).toBe('expired');
			expect(capture?.failureReason).toContain(`${captureDurationMs}ms`);
		} finally {
			jest.useRealTimers();
		}
	});

	it('invalidates all active evidence when the bounded record buffer overflows', async () => {
		const collector = new CommandLatencyTraceCollectorService({ ...config, maxRecords: 4 });
		arm(collector);

		await collector.traceUpdate(
			{ propertyId: config.sourcePropertyId, value: true, windowGeneration: 'generation-1' },
			async () => {
				await Promise.resolve();
				collector.recordWriteComplete(sourceProperty(true));
				collector.recordSourcePublication(sourceProperty(true));
			},
		);

		expect(collector.isEnabled()).toBe(false);
		const [capture] = collector.getCaptures();
		expect(capture?.status).toBe('overflow');
		expect(capture?.failureReason).toContain('record limit');
	});

	it('invalidates an armed capture when the backend lifecycle stops', () => {
		const collector = new CommandLatencyTraceCollectorService(config);
		arm(collector);
		collector.onModuleDestroy();

		const [capture] = collector.getCaptures();
		expect(capture?.status).toBe('shutdown');
		expect(capture?.failureReason).toContain('backend stopped');
	});

	it('invalidates evidence when the private post-capture export sink fails', async () => {
		const collector = new CommandLatencyTraceCollectorService({
			...config,
			exportPath: '/dev/null/fastybird-trace.jsonl',
		});
		arm(collector);
		await collector.traceUpdate(
			{ propertyId: config.sourcePropertyId, value: true, windowGeneration: 'generation-1' },
			async () => {
				await Promise.resolve();
				collector.recordSourcePublication(sourceProperty(true));
			},
		);
		await collector.waitForExports();

		const [capture] = collector.getCaptures();
		expect(capture?.status).toBe('error');
		expect(capture?.failureReason).toContain('sink failed');
	});
});
