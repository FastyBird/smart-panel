import {
	CommandLatencyObserver,
	ObserverTrialConfig,
	TrialResult,
	calculatePercentiles,
	compileSessionReport,
} from '../../../../test/support/command-latency-observer';

describe('CommandLatencyObserver', () => {
	const createConfig = (overrides: Partial<ObserverTrialConfig> = {}): ObserverTrialConfig => ({
		target: {
			deviceId: 'dev-1',
			channelId: 'chan-1',
			propertyId: 'prop-source',
			projectionPropertyId: 'prop-alias',
		},
		commandValue: true,
		previousValue: false,
		timeoutMs: 5000,
		correlationId: 'test-corr-1',
		...overrides,
	});

	it('computes a consistent sha256 source hash for provenance', () => {
		const hash = CommandLatencyObserver.getSourceHash();
		expect(hash).toBeDefined();
		expect(typeof hash).toBe('string');
		expect(hash).toHaveLength(64);
	});

	describe('ordering prerequisites', () => {
		it('rejects subscription-acknowledged before listener-ready', () => {
			const observer = new CommandLatencyObserver(createConfig());
			expect(() => {
				observer.record('subscription-acknowledged', 100);
			}).toThrow('Subscription acknowledgement requires installed listeners');
		});

		it('rejects dispatch before listener-ready', () => {
			const observer = new CommandLatencyObserver(createConfig());
			expect(() => {
				observer.record('dispatch', 100);
			}).toThrow('Dispatch requires installed listeners');
		});

		it('rejects dispatch before subscription-acknowledged', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 50);
			expect(() => {
				observer.record('dispatch', 100);
			}).toThrow('Dispatch requires an acknowledged exchange subscription');
		});

		it('rejects command-ack before dispatch', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 50);
			observer.record('subscription-acknowledged', 60);
			expect(() => {
				observer.record('command-ack', 100);
			}).toThrow('Command acknowledgement requires prior dispatch');
		});

		it('rejects source-event before dispatch', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 50);
			observer.record('subscription-acknowledged', 60);
			expect(() => {
				observer.record('source-event', 100);
			}).toThrow('Source event requires prior dispatch');
		});

		it('rejects projection-event before dispatch', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 50);
			observer.record('subscription-acknowledged', 60);
			expect(() => {
				observer.record('projection-event', 100);
			}).toThrow('Projection event requires prior dispatch');
		});
	});

	describe('monotonic timestamp enforcement', () => {
		it('rejects non-monotonic timestamps', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 100);
			expect(() => {
				observer.record('subscription-acknowledged', 99);
			}).toThrow(/Observer timestamps must be monotonic/);
		});

		it('accepts equal or increasing timestamps', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 100);
			observer.record('subscription-acknowledged', 100);
			observer.record('dispatch', 105);
			expect(observer.has('dispatch')).toBe(true);
		});
	});

	describe('event filtering and correlation', () => {
		it('filters out events for unrelated property ids', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);

			const matched = observer.onPropertyEvent('unrelated-prop', true, 40);
			expect(matched).toBe(false);
			expect(observer.has('source-event')).toBe(false);
		});

		it('filters out source events with non-matching values', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);

			const matched = observer.onPropertyEvent('prop-source', false, 40);
			expect(matched).toBe(false);
			expect(observer.has('source-event')).toBe(false);
		});

		it('accepts matching source events and records source-event stage', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);

			const matched = observer.onPropertyEvent('prop-source', true, 40);
			expect(matched).toBe(true);
			expect(observer.has('source-event')).toBe(true);
		});

		it('accepts matching projection events and records projection-event stage', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);
			observer.onPropertyEvent('prop-source', true, 40);

			const matched = observer.onPropertyEvent('prop-alias', true, 45);
			expect(matched).toBe(true);
			expect(observer.has('projection-event')).toBe(true);
		});

		it('marks trial success when both source and projection arrive', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);
			observer.onPropertyEvent('prop-source', true, 40);
			expect(observer.getResult().status).toBe('pending');

			observer.onPropertyEvent('prop-alias', true, 45);
			expect(observer.getResult().status).toBe('success');
		});

		it('marks trial success immediately after source event when no projection configured', () => {
			const config = createConfig({
				target: {
					deviceId: 'dev-1',
					channelId: 'chan-1',
					propertyId: 'prop-source',
				},
			});
			const observer = new CommandLatencyObserver(config);
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);
			observer.onPropertyEvent('prop-source', true, 40);

			expect(observer.getResult().status).toBe('success');
		});
	});

	describe('timeout and invalidation handling', () => {
		it('records explicit timeout failure without fabricating latency', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);

			observer.recordTimeout(5030);

			const result = observer.getResult();
			expect(result.status).toBe('timeout');
			expect(result.failureReason).toContain('Timed out after 5000ms');
			expect(result.spans.totalConvergenceMs).toBeUndefined();
		});

		it('invalidates trial upon reconnect', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);

			observer.recordReconnect(35, 'Socket reconnect');

			const result = observer.getResult();
			expect(result.status).toBe('invalidated');
			expect(result.failureReason).toBe('Socket reconnect');
		});

		it('rejects recording new stages after trial completion/timeout', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);
			observer.recordTimeout(5030);

			expect(() => {
				observer.record('source-event', 5040);
			}).toThrow(/Cannot record stage 'source-event' after trial has finalized with status 'timeout'/);
		});
	});

	describe('stage span calculation and poll correlation', () => {
		it('computes all stage spans correctly', () => {
			const observer = new CommandLatencyObserver(createConfig());
			observer.record('listener-ready', 10);
			observer.record('subscription-acknowledged', 20);
			observer.record('dispatch', 30);
			observer.record('command-ack', 35);
			observer.record('provider-receipt', 38);
			observer.record('update-entry', 40);
			observer.record('write-commit', 48);
			observer.record('source-event', 50);
			observer.record('projection-event', 55);

			observer.recordPollActivity({
				inFlightPolls: 2,
				activeDrains: 1,
				slotIndex: 3,
				rpcActive: true,
			});

			const result = observer.getResult();
			expect(result.status).toBe('success');
			expect(result.spans.commandToAckMs).toBe(5); // 35 - 30
			expect(result.spans.updateEntryToSourceMs).toBe(10); // 50 - 40
			expect(result.spans.sourceToProjectionMs).toBe(5); // 55 - 50
			expect(result.spans.commandToSourceMs).toBe(20); // 50 - 30
			expect(result.spans.totalConvergenceMs).toBe(25); // 55 - 30
			expect(result.pollActivity).toEqual({
				inFlightPolls: 2,
				activeDrains: 1,
				slotIndex: 3,
				rpcActive: true,
			});
		});
	});

	describe('percentile and session report calculation', () => {
		it('computes percentiles accurately', () => {
			expect(calculatePercentiles([])).toEqual({ p50: null, p95: null, max: null });

			const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
			const { p50, p95, max } = calculatePercentiles(values);
			expect(p50).toBe(60);
			expect(p95).toBe(100);
			expect(max).toBe(100);
		});

		it('compiles session report and verifies write-pipeline engineering gates', () => {
			const createTrialResult = (
				index: number,
				scenario: 'idle' | 'poll-overlap',
				pipelineMs: number,
				status: 'success' | 'timeout' = 'success',
			): TrialResult => ({
				trialIndex: index,
				scenario,
				status,
				target: { deviceId: 'd', channelId: 'c', propertyId: 'p' },
				commandValue: true,
				records: [],
				spans: {
					updateEntryToSourceMs: status === 'success' ? pipelineMs : undefined,
				},
				elapsedMs: pipelineMs,
			});

			// 20 idle trials with pipeline latency < 100ms
			const idleTrials = Array.from({ length: 20 }, (_, i) => createTrialResult(i, 'idle', 10 + i * 2));
			// 20 poll-overlap trials with pipeline latency < 200ms
			const pollOverlapTrials = Array.from({ length: 20 }, (_, i) =>
				createTrialResult(20 + i, 'poll-overlap', 50 + i * 5),
			);

			const report = compileSessionReport([...idleTrials, ...pollOverlapTrials], 'test-rev');

			expect(report.idle.count).toBe(20);
			expect(report.idle.successCount).toBe(20);
			expect(report.idle.timeoutCount).toBe(0);
			expect(report.idle.p95Ms).toBeLessThan(800);

			expect(report.pollOverlap.count).toBe(20);
			expect(report.pollOverlap.successCount).toBe(20);
			expect(report.pollOverlap.timeoutCount).toBe(0);
			expect(report.pollOverlap.p95Ms).toBeLessThan(800);

			expect(report.overallPipelineGatePassed).toBe(true);
		});

		it('fails overallPipelineGate if any trial timed out', () => {
			const createTrialResult = (index: number, status: 'success' | 'timeout'): TrialResult => ({
				trialIndex: index,
				scenario: 'poll-overlap',
				status,
				target: { deviceId: 'd', channelId: 'c', propertyId: 'p' },
				commandValue: true,
				records: [],
				spans: { updateEntryToSourceMs: status === 'success' ? 50 : undefined },
				elapsedMs: 5000,
			});

			const trials = [
				...Array.from({ length: 19 }, (_, i) => createTrialResult(i, 'success')),
				createTrialResult(19, 'timeout'),
			];

			const report = compileSessionReport(trials);
			expect(report.pollOverlap.timeoutCount).toBe(1);
			expect(report.overallPipelineGatePassed).toBe(false);
		});

		it('fails overallPipelineGate if p95 exceeds 800ms', () => {
			const trials: TrialResult[] = Array.from({ length: 20 }, (_, i) => ({
				trialIndex: i,
				scenario: 'idle',
				status: 'success',
				target: { deviceId: 'd', channelId: 'c', propertyId: 'p' },
				commandValue: true,
				records: [],
				spans: { updateEntryToSourceMs: 850 },
				elapsedMs: 850,
			}));

			const report = compileSessionReport(trials);
			expect(report.idle.p95Ms).toBe(850);
			expect(report.overallPipelineGatePassed).toBe(false);
		});
	});
});
