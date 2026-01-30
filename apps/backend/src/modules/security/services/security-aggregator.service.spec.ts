import { Test, TestingModule } from '@nestjs/testing';

import { SecurityAlert, SecuritySignal } from '../contracts/security-signal.type';
import { SecurityStateProviderInterface } from '../contracts/security-state-provider.interface';
import { AlarmState, ArmedState, SECURITY_STATE_PROVIDERS, SecurityAlertType, Severity } from '../security.constants';

import { SecurityAggregatorService } from './security-aggregator.service';

class FakeProvider implements SecurityStateProviderInterface {
	constructor(
		private readonly key: string,
		private readonly signal: SecuritySignal,
	) {}

	getKey(): string {
		return this.key;
	}

	getSignals(): SecuritySignal {
		return this.signal;
	}
}

function makeAlert(overrides: Partial<SecurityAlert> & { id: string }): SecurityAlert {
	return {
		type: SecurityAlertType.SMOKE,
		severity: Severity.CRITICAL,
		timestamp: '2025-06-15T12:00:00Z',
		acknowledged: false,
		...overrides,
	};
}

describe('SecurityAggregatorService', () => {
	async function createAggregator(providers: SecurityStateProviderInterface[]): Promise<SecurityAggregatorService> {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: SECURITY_STATE_PROVIDERS,
					useValue: providers,
				},
				SecurityAggregatorService,
			],
		}).compile();

		return module.get<SecurityAggregatorService>(SecurityAggregatorService);
	}

	it('should call all providers', async () => {
		const provider1 = new FakeProvider('a', {});
		const provider2 = new FakeProvider('b', {});

		const spy1 = jest.spyOn(provider1, 'getSignals');
		const spy2 = jest.spyOn(provider2, 'getSignals');

		const aggregator = await createAggregator([provider1, provider2]);
		await aggregator.aggregate();

		expect(spy1).toHaveBeenCalled();
		expect(spy2).toHaveBeenCalled();
	});

	it('should return defaults with empty providers', async () => {
		const aggregator = await createAggregator([]);
		const result = await aggregator.aggregate();

		expect(result.armedState).toBeNull();
		expect(result.alarmState).toBeNull();
		expect(result.highestSeverity).toBe(Severity.INFO);
		expect(result.activeAlertsCount).toBe(0);
		expect(result.hasCriticalAlert).toBe(false);
		expect(result.lastEvent).toBeUndefined();
		expect(result.activeAlerts).toEqual([]);
	});

	it('should return defaults with dummy provider', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('default', {
				highestSeverity: Severity.INFO,
				activeAlertsCount: 0,
				hasCriticalAlert: false,
			}),
		]);

		const result = await aggregator.aggregate();

		expect(result.armedState).toBeNull();
		expect(result.alarmState).toBeNull();
		expect(result.highestSeverity).toBe(Severity.INFO);
		expect(result.activeAlertsCount).toBe(0);
		expect(result.hasCriticalAlert).toBe(false);
		expect(result.activeAlerts).toEqual([]);
	});

	it('should pick max severity across providers (no alerts fallback)', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', { highestSeverity: Severity.INFO }),
			new FakeProvider('b', { highestSeverity: Severity.CRITICAL }),
			new FakeProvider('c', { highestSeverity: Severity.WARNING }),
		]);

		const result = await aggregator.aggregate();

		expect(result.highestSeverity).toBe(Severity.CRITICAL);
	});

	it('should sum activeAlertsCount across providers (no alerts fallback)', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', { activeAlertsCount: 3 }),
			new FakeProvider('b', { activeAlertsCount: 5 }),
		]);

		const result = await aggregator.aggregate();

		expect(result.activeAlertsCount).toBe(8);
	});

	it('should set hasCriticalAlert true if any provider reports true (no alerts fallback)', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', { hasCriticalAlert: false }),
			new FakeProvider('b', { hasCriticalAlert: true }),
		]);

		const result = await aggregator.aggregate();

		expect(result.hasCriticalAlert).toBe(true);
	});

	it('should set hasCriticalAlert true if computed severity is critical (no alerts fallback)', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', { highestSeverity: Severity.CRITICAL, hasCriticalAlert: false }),
		]);

		const result = await aggregator.aggregate();

		expect(result.hasCriticalAlert).toBe(true);
	});

	it('should use first non-null armedState', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', { armedState: null }),
			new FakeProvider('b', { armedState: ArmedState.ARMED_HOME }),
			new FakeProvider('c', { armedState: ArmedState.ARMED_AWAY }),
		]);

		const result = await aggregator.aggregate();

		expect(result.armedState).toBe(ArmedState.ARMED_HOME);
	});

	it('should use first non-null alarmState', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', {}),
			new FakeProvider('b', { alarmState: AlarmState.TRIGGERED }),
			new FakeProvider('c', { alarmState: AlarmState.IDLE }),
		]);

		const result = await aggregator.aggregate();

		expect(result.alarmState).toBe(AlarmState.TRIGGERED);
	});

	it('should select newest lastEvent by timestamp (no alerts fallback)', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', {
				lastEvent: { type: 'old', timestamp: '2025-01-01T00:00:00Z' },
			}),
			new FakeProvider('b', {
				lastEvent: { type: 'new', timestamp: '2025-06-15T12:00:00Z' },
			}),
			new FakeProvider('c', {
				lastEvent: { type: 'mid', timestamp: '2025-03-01T00:00:00Z' },
			}),
		]);

		const result = await aggregator.aggregate();

		expect(result.lastEvent).toBeDefined();
		expect(result.lastEvent?.type).toBe('new');
		expect(result.lastEvent?.timestamp).toBe('2025-06-15T12:00:00Z');
	});

	it('should select newest lastEvent with different timezone formats', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', {
				// This is actually the newest instant (2025-06-15T17:00:00Z)
				lastEvent: { type: 'newest', timestamp: '2025-06-15T12:00:00-05:00' },
			}),
			new FakeProvider('b', {
				// 2025-06-15T12:00:00Z — earlier than provider a despite higher lexicographic value for the date part
				lastEvent: { type: 'older', timestamp: '2025-06-15T12:00:00+00:00' },
			}),
		]);

		const result = await aggregator.aggregate();

		expect(result.lastEvent).toBeDefined();
		expect(result.lastEvent?.type).toBe('newest');
	});

	it('should handle provider that returns null', async () => {
		const nullProvider: SecurityStateProviderInterface = {
			getKey: () => 'null',
			getSignals: () => null as unknown as SecuritySignal,
		};

		const aggregator = await createAggregator([nullProvider, new FakeProvider('good', { activeAlertsCount: 3 })]);

		const result = await aggregator.aggregate();

		expect(result.activeAlertsCount).toBe(3);
	});

	it('should handle provider that returns undefined', async () => {
		const undefProvider: SecurityStateProviderInterface = {
			getKey: () => 'undef',
			getSignals: () => undefined as unknown as SecuritySignal,
		};

		const aggregator = await createAggregator([undefProvider, new FakeProvider('good', { activeAlertsCount: 1 })]);

		const result = await aggregator.aggregate();

		expect(result.activeAlertsCount).toBe(1);
	});

	it('should skip lastEvent with invalid timestamp and prefer valid one', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', {
				lastEvent: { type: 'invalid', timestamp: 'not-a-date' },
			}),
			new FakeProvider('b', {
				lastEvent: { type: 'valid', timestamp: '2025-06-15T12:00:00Z' },
			}),
		]);

		const result = await aggregator.aggregate();

		expect(result.lastEvent).toBeDefined();
		expect(result.lastEvent?.type).toBe('valid');
	});

	it('should replace invalid-timestamp lastEvent with valid one from later provider', async () => {
		const aggregator = await createAggregator([
			new FakeProvider('a', {
				lastEvent: { type: 'bad-first', timestamp: 'garbage' },
			}),
			new FakeProvider('b', {
				lastEvent: { type: 'good-second', timestamp: '2025-01-01T00:00:00Z' },
			}),
		]);

		const result = await aggregator.aggregate();

		expect(result.lastEvent?.type).toBe('good-second');
	});

	it('should handle provider that throws', async () => {
		const badProvider: SecurityStateProviderInterface = {
			getKey: () => 'bad',
			getSignals: () => {
				throw new Error('boom');
			},
		};

		const aggregator = await createAggregator([badProvider, new FakeProvider('good', { activeAlertsCount: 2 })]);

		const result = await aggregator.aggregate();

		expect(result.activeAlertsCount).toBe(2);
	});

	it('should handle provider where both getSignals and getKey throw', async () => {
		const malformedProvider: SecurityStateProviderInterface = {
			getKey: () => {
				throw new Error('getKey boom');
			},
			getSignals: () => {
				throw new Error('getSignals boom');
			},
		};

		const aggregator = await createAggregator([malformedProvider, new FakeProvider('good', { activeAlertsCount: 4 })]);

		const result = await aggregator.aggregate();

		expect(result.activeAlertsCount).toBe(4);
	});

	// --- activeAlerts tests ---

	describe('activeAlerts merging', () => {
		it('should return activeAlerts from providers', async () => {
			const alerts: SecurityAlert[] = [
				makeAlert({ id: 'sensor:d1:smoke', sourceDeviceId: 'd1' }),
			];

			const aggregator = await createAggregator([
				new FakeProvider('sensors', { activeAlerts: alerts }),
			]);

			const result = await aggregator.aggregate();

			expect(result.activeAlerts).toHaveLength(1);
			expect(result.activeAlerts[0].id).toBe('sensor:d1:smoke');
		});

		it('should concatenate alerts from multiple providers', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('sensors', {
					activeAlerts: [makeAlert({ id: 'sensor:d1:smoke' })],
				}),
				new FakeProvider('alarm', {
					activeAlerts: [makeAlert({ id: 'alarm:d2:intrusion' })],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.activeAlerts).toHaveLength(2);
		});

		it('should de-duplicate alerts by id (newest timestamp wins)', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [makeAlert({ id: 'sensor:d1:smoke', timestamp: '2025-01-01T00:00:00Z' })],
				}),
				new FakeProvider('b', {
					activeAlerts: [makeAlert({ id: 'sensor:d1:smoke', timestamp: '2025-06-15T12:00:00Z' })],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.activeAlerts).toHaveLength(1);
			expect(result.activeAlerts[0].timestamp).toBe('2025-06-15T12:00:00Z');
		});

		it('should compute activeAlertsCount from merged alerts', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'sensor:d1:smoke' }),
						makeAlert({ id: 'sensor:d2:co', type: SecurityAlertType.CO }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.activeAlertsCount).toBe(2);
			expect(result.activeAlertsCount).toBe(result.activeAlerts.length);
		});

		it('should compute highestSeverity from alerts', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'a1', severity: Severity.INFO }),
						makeAlert({ id: 'a2', severity: Severity.WARNING }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.highestSeverity).toBe(Severity.WARNING);
		});

		it('should compute hasCriticalAlert from alerts', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'a1', severity: Severity.WARNING }),
						makeAlert({ id: 'a2', severity: Severity.CRITICAL }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.hasCriticalAlert).toBe(true);
		});

		it('should set hasCriticalAlert false when no critical alerts', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [makeAlert({ id: 'a1', severity: Severity.WARNING })],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.hasCriticalAlert).toBe(false);
		});

		it('should derive lastEvent from newest alert', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'a1', timestamp: '2025-01-01T00:00:00Z', type: SecurityAlertType.SMOKE }),
						makeAlert({ id: 'a2', timestamp: '2025-06-15T12:00:00Z', type: SecurityAlertType.CO }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.lastEvent).toBeDefined();
			expect(result.lastEvent?.type).toBe(SecurityAlertType.CO);
			expect(result.lastEvent?.timestamp).toBe('2025-06-15T12:00:00Z');
		});

		it('should use severity tie-breaker for lastEvent when timestamps equal', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'a1', timestamp: '2025-06-15T12:00:00Z', severity: Severity.WARNING, type: SecurityAlertType.FAULT }),
						makeAlert({ id: 'a2', timestamp: '2025-06-15T12:00:00Z', severity: Severity.CRITICAL, type: SecurityAlertType.SMOKE }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.lastEvent?.type).toBe(SecurityAlertType.SMOKE);
		});

		it('should use id tie-breaker for lastEvent when timestamps and severity equal', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'b-alert', timestamp: '2025-06-15T12:00:00Z', severity: Severity.CRITICAL }),
						makeAlert({ id: 'a-alert', timestamp: '2025-06-15T12:00:00Z', severity: Severity.CRITICAL }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.lastEvent?.timestamp).toBe('2025-06-15T12:00:00Z');
			// a-alert < b-alert lexicographically, so a-alert wins
		});

		it('should sort alerts by severity desc, timestamp desc, id asc', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'a1', severity: Severity.INFO, timestamp: '2025-06-15T12:00:00Z' }),
						makeAlert({ id: 'a2', severity: Severity.CRITICAL, timestamp: '2025-01-01T00:00:00Z' }),
						makeAlert({ id: 'a3', severity: Severity.WARNING, timestamp: '2025-03-01T00:00:00Z' }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.activeAlerts[0].id).toBe('a2');
			expect(result.activeAlerts[1].id).toBe('a3');
			expect(result.activeAlerts[2].id).toBe('a1');
		});

		it('should ignore providers without activeAlerts and still use provider-level fields', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', { highestSeverity: Severity.WARNING, activeAlertsCount: 2, hasCriticalAlert: false }),
				new FakeProvider('b', { highestSeverity: Severity.INFO }),
			]);

			const result = await aggregator.aggregate();

			// No activeAlerts from any provider, so fallback to provider-level fields
			expect(result.activeAlerts).toEqual([]);
			expect(result.activeAlertsCount).toBe(2);
			expect(result.highestSeverity).toBe(Severity.WARNING);
		});

		it('should prefer alert-derived fields over provider-level fields when alerts exist', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					highestSeverity: Severity.INFO,
					activeAlertsCount: 0,
					hasCriticalAlert: false,
					activeAlerts: [makeAlert({ id: 'a1', severity: Severity.CRITICAL })],
				}),
			]);

			const result = await aggregator.aggregate();

			expect(result.activeAlertsCount).toBe(1);
			expect(result.highestSeverity).toBe(Severity.CRITICAL);
			expect(result.hasCriticalAlert).toBe(true);
		});

		it('should set acknowledged=false on all alerts', async () => {
			const aggregator = await createAggregator([
				new FakeProvider('a', {
					activeAlerts: [
						makeAlert({ id: 'a1', acknowledged: false }),
						makeAlert({ id: 'a2', acknowledged: false }),
					],
				}),
			]);

			const result = await aggregator.aggregate();

			for (const alert of result.activeAlerts) {
				expect(alert.acknowledged).toBe(false);
			}
		});

		it('should preserve alert IDs deterministically across calls', async () => {
			const alerts = [
				makeAlert({ id: 'sensor:d1:smoke' }),
				makeAlert({ id: 'alarm:d2:intrusion' }),
			];

			const aggregator = await createAggregator([
				new FakeProvider('a', { activeAlerts: alerts }),
			]);

			const result1 = await aggregator.aggregate();
			const result2 = await aggregator.aggregate();

			expect(result1.activeAlerts.map((a) => a.id)).toEqual(result2.activeAlerts.map((a) => a.id));
		});
	});
});
