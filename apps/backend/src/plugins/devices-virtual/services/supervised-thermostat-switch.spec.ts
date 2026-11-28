import { EventEmitter2 } from '@nestjs/event-emitter';

import { DataTypeType, EventType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import {
	IDevicePlatform,
	IDevicePropertyData,
	PropertyReadRequest,
} from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyReadProofService } from '../../../modules/devices/services/property-read-proof.service';
import { nextSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { SUPERVISED_SWITCH_PROFILE } from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { SupervisedThermostatSwitch } from './supervised-thermostat-switch';
import { thermostatActuatorIdentity } from './virtual-thermostat-contract.utils';

describe('a software-supervised switch from a new device plugin', () => {
	const fixture = (readable: boolean, preparation?: 'declined' | 'prepared') => {
		const registry = new PlatformRegistryService();
		const events = new EventEmitter2();
		let sample: QualifiedPropertySample | null = null;
		const source = { alive: true };
		const values = {
			captureSampleSourceGuard: () => () => source.alive,
			readQualifiedSample: () => sample,
		} as unknown as PropertyValueService;
		const device = { type: 'future-switch', id: 'pump' } as DeviceEntity;
		const channel = Object.assign(new ChannelEntity(), { id: 'relay', device });
		const property = Object.assign(new ChannelPropertyEntity(), {
			id: 'contact',
			channel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		const target = { device, channel, property, value: false };
		const physicalIdentity = thermostatActuatorIdentity(property, channel, device);
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			id: 'claim',
			controllerId: 'thermostat',
			physicalIdentity,
			revision: 1,
			providerProfile: SUPERVISED_SWITCH_PROFILE,
			providerProfileVersion: 1,
			independentProtectionAcknowledged: true,
			qualificationGeneration: 'generation',
		});
		const evidence = {
			contractVersion: 1 as const,
			providerProfile: { id: SUPERVISED_SWITCH_PROFILE, version: 1 },
			physicalIdentity,
			qualificationGeneration: 'generation',
			upstreamWritersExcluded: false,
			opposedOutputsInterlocked: false,
			profile: {},
			machineLeaseIsCurrent: () => true,
		};
		const scope = {
			controllerId: claim.controllerId,
			controllerRevision: 1,
			claimId: claim.id,
			claimRevision: 1,
			contractFingerprint: 'contract',
			qualification: evidence,
		};
		const request = jest.fn((query: PropertyReadRequest) => {
			query.dispatching();
			return Promise.resolve(true);
		});
		const processBatch = jest.fn((_updates: IDevicePropertyData[]) => Promise.resolve(true));
		const dispatch = jest.fn(() => Promise.resolve(true));
		const platform: IDevicePlatform = {
			getType: () => device.type,
			process: jest.fn(),
			processBatch,
			...(preparation && {
				prepareCompositeBatch: (updates: IDevicePropertyData[]) =>
					Promise.resolve(preparation === 'prepared' ? { updates, isCurrent: () => true, dispatch } : null),
			}),
			...(readable ? { requestPropertyRead: request } : {}),
		};
		const registration = registry.registerOwned(platform);
		const supervisor = new SupervisedThermostatSwitch(registry, values, new PropertyReadProofService(registry, events));
		const adapter = supervisor.capture(target);
		const report = (flags: Partial<QualifiedPropertySample> = {}) => {
			const at = new Date();
			sample = {
				propertyId: property.id,
				value: false,
				sampledAt: at,
				receivedAt: at,
				provenance: 'live',
				quality: 'good',
				reasons: [],
				ingressSequence: nextSampleIngress(),
				...flags,
			};
			events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, { propertyId: property.id, sample });
			return sample;
		};
		const drain = (off: QualifiedPropertySample) => adapter.reconcile(target, ['off'], off, () => true, scope);
		return {
			adapter,
			supervisor,
			registration,
			claim,
			target,
			evidence,
			scope,
			report,
			source,
			request,
			processBatch,
			dispatch,
			platform,
			drain,
		};
	};

	it.each([true, false])('proves OFF from the first physical report with read support %s', async (readable) => {
		const f = fixture(readable);
		try {
			await f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
			expect(f.request).toHaveBeenCalledTimes(readable ? 1 : 0);
			for (const flags of [{ commandEcho: true as const }, { replay: true as const }, { sampledAt: new Date(0) }]) {
				const echo = f.report(flags);
				await expect(f.drain(echo)).resolves.toBeNull();
			}
			const report = f.report();
			await Promise.resolve();
			const proof = await f.drain(report);
			expect(proof?.supervisedOffCommandId).toBe('off');
			expect(proof?.sourceIsCurrent()).toBe(true);
			expect(proof?.externalWriterBarrier).toBeUndefined();
			f.registration.dispose();
			expect(proof?.sourceIsCurrent()).toBe(false);
		} finally {
			f.supervisor.destroy();
		}
	});

	it.each(['ordinary batch', 'prepared batch', 'unsupported property read'] as const)(
		'uses a physical OFF received during %s only after dispatch succeeds',
		async (path) => {
			const f = fixture(path === 'unsupported property read', path === 'prepared batch' ? 'prepared' : undefined);
			f.request.mockResolvedValue(false);
			let complete: (sent: boolean) => void;
			let emitted: (sample: QualifiedPropertySample) => void;
			const duringDispatch = new Promise<QualifiedPropertySample>((resolve) => {
				emitted = resolve;
			});
			const send = () =>
				new Promise<boolean>((resolve) => {
					complete = resolve;
					emitted(f.report());
				});
			if (path === 'prepared batch') f.dispatch.mockImplementationOnce(send);
			else f.processBatch.mockImplementationOnce(send);
			try {
				const command = f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
				const off = await duringDispatch;
				await expect(f.drain(off)).resolves.toBeNull();
				complete(true);
				await expect(command).resolves.toMatchObject({ outcome: 'accepted' });
				expect((await f.drain(off))?.supervisedOffCommandId).toBe('off');
			} finally {
				f.supervisor.destroy();
			}
		},
	);

	it.each(['declined', 'threw'] as const)('discards an early OFF when the dispatch %s', async (outcome) => {
		const f = fixture(false);
		let off: QualifiedPropertySample;
		f.processBatch.mockImplementationOnce(() => {
			off = f.report();
			return outcome === 'declined' ? Promise.resolve(false) : Promise.reject(new Error('dispatch failed'));
		});
		try {
			const command = f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
			if (outcome === 'declined') await expect(command).resolves.toMatchObject({ outcome: 'unknown' });
			else await expect(command).rejects.toThrow('dispatch failed');
			await expect(f.drain(off)).resolves.toBeNull();
			expect(f.supervisor.awaitingReport(f.claim)).toBe(false);
		} finally {
			f.supervisor.destroy();
		}
	});

	it('keeps the read dispatch boundary when the platform sends an explicit read', async () => {
		const f = fixture(true);
		let early: QualifiedPropertySample;
		f.processBatch.mockImplementationOnce(() => {
			early = f.report();
			return Promise.resolve(true);
		});
		try {
			await f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
			expect(f.request).toHaveBeenCalledTimes(1);
			await expect(f.drain(early)).resolves.toBeNull();
			const afterRead = f.report();
			await Promise.resolve();
			expect((await f.drain(afterRead))?.supervisedOffCommandId).toBe('off');
		} finally {
			f.supervisor.destroy();
		}
	});

	it('recovers the physical OFF reported during the command when a marked read fails to send', async () => {
		const f = fixture(true);
		let off: QualifiedPropertySample;
		f.processBatch.mockImplementationOnce(() => {
			off = f.report();
			return Promise.resolve(true);
		});
		f.request.mockImplementationOnce((read) => {
			read.dispatching();
			return Promise.resolve(false);
		});
		try {
			await f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
			expect(f.request).toHaveBeenCalledTimes(1);
			expect((await f.drain(off))?.supervisedOffCommandId).toBe('off');
		} finally {
			f.supervisor.destroy();
		}
	});

	it('accepts an infrequent report between the OFF retry deadline and the next evaluation', async () => {
		const f = fixture(false);
		jest.useFakeTimers();
		try {
			await f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
			jest.advanceTimersByTime(120_000);
			expect(f.supervisor.awaitingReport(f.claim)).toBe(false);
			const sample = f.report();
			await Promise.resolve();
			expect((await f.drain(sample))?.supervisedOffCommandId).toBe('off');
		} finally {
			f.supervisor.destroy();
			jest.useRealTimers();
		}
	});

	it('refuses a different property passed to a captured switch, including for an absolute OFF', async () => {
		const f = fixture(false);
		try {
			const other = {
				...f.target,
				property: Object.assign(new ChannelPropertyEntity(), f.target.property, { id: 'other-switch' }),
			};
			expect(f.adapter.canReconcile(other, f.evidence)).toBe(false);
			await expect(f.adapter.send(other, f.claim, f.evidence, () => true, { commandId: 'off' })).resolves.toMatchObject(
				{ outcome: 'refused' },
			);
			expect(f.processBatch).not.toHaveBeenCalled();
		} finally {
			f.supervisor.destroy();
		}
	});

	it('waits for an in-flight ON before sending OFF and requires a report after that OFF', async () => {
		// Some plugins implement prepared dispatch only for a subset of their properties.
		const f = fixture(false, 'declined');
		let completeOn: (result: boolean) => void;
		let notifyOn: () => void;
		const onStarted = new Promise<void>((resolve) => {
			notifyOn = resolve;
		});
		f.processBatch.mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					completeOn = resolve;
					notifyOn();
				}),
		);
		try {
			const on = f.adapter.send({ ...f.target, value: true }, f.claim, f.evidence, () => true, { commandId: 'on' });
			await onStarted;
			const off = f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
			const early = f.report();
			await expect(f.drain(early)).resolves.toBeNull();
			expect(f.processBatch).toHaveBeenCalledTimes(1);
			completeOn(true);
			await Promise.all([on, off]);
			expect(f.processBatch.mock.calls.map(([batch]) => batch[0].value)).toEqual([true, false]);
			await expect(f.drain(early)).resolves.toBeNull();
			const observed = f.report();
			await Promise.resolve();
			expect((await f.drain(observed))?.supervisedOffCommandId).toBe('off');
		} finally {
			f.supervisor.destroy();
		}
	});

	it('accepts OFF without an acknowledgement, gates ON, and invalidates old observations when ON is dispatched', async () => {
		const f = fixture(false);
		try {
			const start = () =>
				f.adapter.send({ ...f.target, value: true }, f.claim, f.evidence, () => true, { commandId: 'on' });
			f.claim.independentProtectionAcknowledged = false;
			expect((await start()).outcome).toBe('refused');
			expect(f.processBatch).not.toHaveBeenCalled();
			expect((await f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' })).outcome).toBe(
				'accepted',
			);
			const report = f.report();
			await Promise.resolve();
			const proof = await f.drain(report);
			expect(proof?.isCurrent()).toBe(true);
			f.claim.independentProtectionAcknowledged = true;
			expect((await start()).outcome).toBe('accepted');
			expect(proof?.isCurrent()).toBe(false);
			await expect(f.drain(report)).resolves.toBeNull();
		} finally {
			f.supervisor.destroy();
		}
	});

	it('revokes a captured send on replacement of the platform method and a report on loss of its source', async () => {
		const f = fixture(false);
		try {
			await f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'off' });
			const report = f.report();
			await Promise.resolve();
			const original = await f.drain(report);
			expect(original?.sourceIsCurrent()).toBe(true);
			f.source.alive = false;
			expect(original.sourceIsCurrent()).toBe(false);
			await expect(f.drain(report)).resolves.toBeNull();
			const replacement = jest.fn(() => Promise.resolve(true));
			f.platform.processBatch = replacement;
			await expect(
				f.adapter.send(f.target, f.claim, f.evidence, () => true, { commandId: 'late' }),
			).resolves.toMatchObject({ outcome: 'refused' });
			expect(replacement).not.toHaveBeenCalled();
		} finally {
			f.supervisor.destroy();
		}
	});
});
