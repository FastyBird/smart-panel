import { instanceToPlain } from 'class-transformer';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { StorageService } from '../../storage/services/storage.service';
import { DataTypeType, EventType, PropertyCategory } from '../devices.constants';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { DerivedPropertyPublication, PropertySampleEvidence } from '../models/property-sample.model';
import { PropertyValueState, clonePropertyValueState } from '../models/property-value-state.model';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyMetadataService } from './property-metadata.service';
import { PropertyProducerRegistryService } from './property-producer.registry.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueLockService } from './property-value-lock.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

class SampleProperty extends ChannelPropertyEntity {
	get type(): string {
		return 'qualified-test';
	}
}

function deferred<T>() {
	let resolve: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve: (value: T) => resolve(value) };
}

describe('qualified samples and producer state', () => {
	let property: SampleProperty;
	let values: PropertyValueService;
	let reports: ChannelsPropertiesService;
	let windows: PropertyCommandWindowService;
	let producers: PropertyProducerRegistryService;
	let events: EventEmitter2;
	let accepted: jest.Mock;
	let invalidated: jest.Mock;
	let scalar: jest.Mock;
	let quality: jest.Mock;
	let storage: {
		isConnected: jest.Mock;
		writePoints: jest.Mock;
		enqueueWritePoint: jest.Mock;
		flushQueuedWrites: jest.Mock;
		query: jest.Mock;
		queryStrict: jest.Mock;
	};
	const base = Date.parse('2026-10-13T10:00:00Z');
	const evidence = (
		sample = base,
		provenance: PropertySampleEvidence['provenance'] = 'live',
		observed = base,
	): PropertySampleEvidence => ({
		sampledAt: new Date(sample),
		receivedAt: new Date(Date.now()),
		provenance,
		observedAt: new Date(observed),
	});
	const publication = (
		sample = base,
		evaluated = Date.now(),
		expires = evaluated + 10_000,
	): DerivedPropertyPublication => ({
		quality: 'good',
		reasons: [],
		sampledAt: new Date(sample),
		evaluatedAt: new Date(evaluated),
		expiresAt: new Date(expires),
	});
	const report = (value: number | null, sampleEvidence = evidence()) =>
		reports.reportSample(property.id, { value } as UpdateChannelPropertyDto, sampleEvidence);
	const open = (value = 23) =>
		windows.open({
			canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: property.id },
			requestedTargets: [],
			commandedValue: value,
			previousValue: 20,
			ttlMs: 3_000,
		});

	beforeEach(() => {
		jest.useFakeTimers({ now: base });
		property = Object.assign(new SampleProperty(), {
			id: 'sample-property',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			step: null,
			format: [-100, 150],
			invalid: -999,
			unit: '°C',
			value: new PropertyValueState(),
			channel: 'channel',
		});
		events = new EventEmitter2();
		accepted = jest.fn();
		invalidated = jest.fn();
		scalar = jest.fn();
		quality = jest.fn();
		events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, accepted);
		events.on(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED, invalidated);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, scalar);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, quality);
		producers = new PropertyProducerRegistryService(events);
		storage = {
			isConnected: jest.fn(() => true),
			writePoints: jest.fn().mockResolvedValue(undefined),
			enqueueWritePoint: jest.fn().mockResolvedValue(undefined),
			flushQueuedWrites: jest.fn().mockResolvedValue(undefined),
			query: jest.fn().mockResolvedValue([]),
			queryStrict: jest.fn().mockResolvedValue([]),
		};
		const sources = new PropertyValueSourceRegistryService();
		values = new PropertyValueService(
			storage as unknown as StorageService,
			sources,
			new PropertyValueLockService({} as never),
			producers,
			events,
		);
		windows = new PropertyCommandWindowService();
		reports = new ChannelsPropertiesService(
			{} as never,
			{
				getMapping: () => ({ type: property.type, class: SampleProperty, updateDto: UpdateChannelPropertyDto }),
			} as unknown as ChannelsPropertiesTypeMapperService,
			values,
			sources,
			new DeviceStructureLockService(),
			new PropertyStateCoordinatorService(),
			windows,
			{} as never,
			events,
			undefined,
			{ findOne: () => Promise.resolve(property) } as unknown as PropertyMetadataService,
		);
	});

	afterEach(() => {
		producers.onModuleDestroy();
		reports.onModuleDestroy();
		jest.useRealTimers();
	});

	it.each([21, null])('drops an obsolete provider generation before valid or fault admission: %s', async (value) => {
		await report(20);
		const handle = open(21);
		jest.setSystemTime(base + 1_000);
		await report(value, { ...evidence(base + 1_000), isCurrent: () => false });
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
		expect(windows.get(property.id)).toMatchObject({ generation: handle.generation, state: 'pending' });
		expect(accepted).toHaveBeenCalledTimes(1);
		expect(invalidated).not.toHaveBeenCalled();
		expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(1);
	});

	it('rechecks generation after asynchronous history admission before acceptance or command confirmation', async () => {
		await report(20);
		const handle = open(23);
		jest.setSystemTime(base + 1_000);
		let current = true;
		const admitted = deferred<void>();
		const release = deferred<void>();
		storage.enqueueWritePoint.mockImplementation(async () => {
			admitted.resolve(undefined);
			await release.promise;
		});
		const pending = report(23, { ...evidence(base + 1_000), isCurrent: () => current });
		await admitted.promise;
		current = false;
		release.resolve(undefined);
		await pending;
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
		expect(windows.get(property.id)).toMatchObject({ generation: handle.generation, state: 'pending' });
		expect(accepted).toHaveBeenCalledTimes(1);
		expect(scalar).toHaveBeenCalledTimes(1);
	});

	it('qualifies only the exact incorporated live acceptance and its current provider identity', async () => {
		let sourceCurrent = true;
		await report(20, { ...evidence(), sourceIsCurrent: () => sourceCurrent });
		const sourceSample = values.readQualifiedSample(property, 10000);
		const output = Object.assign(new SampleProperty(), property, { id: 'derived-property' });
		const lease = producers.register(output, 1);
		await values.publishDerived(output, lease, 21, {
			...publication(),
			sourceSample: { propertyId: property.id, acceptanceGeneration: sourceSample.acceptanceGeneration },
		});
		expect(values.readQualifiedSample(output, 10000)?.value).toBe(21);
		await report(20, { ...evidence(), sourceIsCurrent: () => sourceCurrent });
		expect(values.readQualifiedSample(property, 10000).acceptanceGeneration).toBeGreaterThan(
			sourceSample.acceptanceGeneration,
		);
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
		const current = values.readQualifiedSample(property, 10000);
		await values.publishDerived(output, lease, 21, {
			...publication(),
			sourceSample: { propertyId: property.id, acceptanceGeneration: current.acceptanceGeneration },
		});
		expect(values.readQualifiedSample(output, 10000)?.value).toBe(21);
		sourceCurrent = false;
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
		producers.unregister(lease);
		expect(producers.readIncorporatedSample(output.id)).toBeNull();
		producers.register(output, 2);
		expect(values.readQualifiedSample(output, 10000)).toBeNull();
	});

	it('consults the accepted source generation at reads and omits its guard from sample events', async () => {
		let current = true;
		await report(20, { ...evidence(), isCurrent: () => current });
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
		const [event] = accepted.mock.calls[0] as [{ sample: unknown }];
		expect(event.sample).not.toHaveProperty('isCurrent');
		current = false;
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('keeps last qualified measurement while a newer packet is being verified under the same source identity', async () => {
		let latestPacket = true;
		let sourceIdentity = true;
		await report(20, { ...evidence(), isCurrent: () => latestPacket, sourceIsCurrent: () => sourceIdentity });
		latestPacket = false;
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
		jest.setSystemTime(base + 1_000);
		await report(null, { ...evidence(base + 1_000), isCurrent: () => true, sourceIsCurrent: () => sourceIdentity });
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		jest.setSystemTime(base + 2_000);
		await report(21, { ...evidence(base + 2_000), isCurrent: () => true, sourceIsCurrent: () => sourceIdentity });
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(21);
		sourceIdentity = false;
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('refuses admission when stable source identity is obsolete despite a current packet guard', async () => {
		const handle = open(23);
		await report(23, { ...evidence(), isCurrent: () => true, sourceIsCurrent: () => false });
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		expect(windows.get(property.id)).toMatchObject({ generation: handle.generation, state: 'pending' });
		expect(accepted).not.toHaveBeenCalled();
		expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
	});

	it('accepts unchanged heartbeats exactly once without history or energy scalar events', async () => {
		await report(20);
		jest.setSystemTime(base + 1_000);
		await report(20, evidence(base + 1_000));
		expect(accepted).toHaveBeenCalledTimes(2);
		expect(scalar).toHaveBeenCalledTimes(1);
		expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(1);
		expect(values.readQualifiedSample(property, 1_000)?.sampledAt).toEqual(new Date(base + 1_000));
	});

	it.each([null, -999, NaN, Infinity, 151])(
		'revokes qualification on admitted fault %s without changing physical scalar/history',
		async (fault) => {
			await report(20);
			jest.setSystemTime(base + 1_000);
			await report(fault, evidence(base + 1_000));
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
			expect((await values.readLatest(property))?.value).toBe(20);
			expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(1);
			expect(invalidated).toHaveBeenCalledTimes(1);
			expect(accepted).toHaveBeenCalledTimes(1);
		},
	);

	it('keeps the live source watermark through faults; equal faults dominate and recovery requires newer samples', async () => {
		await report(20);
		await report(null);
		await report(21);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		jest.setSystemTime(base + 1_000);
		await report(22, evidence(base + 1_000));
		await report(null, evidence(base));
		await report(19, evidence(base));
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(22);
		expect((await values.readLatest(property))?.value).toBe(22);
	});

	it.each(['cached', 'retained'] as const)(
		'allows initial %s display replay but never qualifies or replaces a live epoch',
		async (provenance) => {
			await report(20, evidence(base, provenance));
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
			await report(20);
			expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
			jest.setSystemTime(base + 1_000);
			await report(21, evidence(base + 1_000, provenance));
			await report(null, evidence(base + 1_000, provenance));
			expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
		},
	);

	it('does not launder replay age or persisted startup history into qualified inputs', async () => {
		jest.setSystemTime(base + 60_000);
		await report(20, evidence(base));
		expect(values.readQualifiedSample(property, 30_000)).toBeNull();
		const other = Object.assign(new SampleProperty(), property, { id: 'cold-property' });
		storage.query.mockResolvedValue([{ propertyId: other.id, numberValue: 30, time: new Date(base + 60_000) }]);
		expect((await values.readLatest(other))?.value).toBe(30);
		expect(values.readQualifiedSample(other, 30_000)).toBeNull();
	});

	it.each(['cached', 'retained', 'old_poll', 'missing_observation'] as const)(
		'cannot confirm a command with %s evidence',
		async (kind) => {
			open();
			jest.setSystemTime(base + 1_000);
			const input = evidence(base + 1_000, kind === 'cached' || kind === 'retained' ? kind : 'live', base - 1);
			await report(23, kind === 'missing_observation' ? { ...input, observedAt: undefined } : input);
			expect(windows.get(property.id)?.state).toBe('pending');
			expect(accepted).not.toHaveBeenCalled();
			expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
		},
	);

	it('confirms a causal poll with a skewed older source clock, using server observation time', async () => {
		open();
		jest.setSystemTime(base + 1_000);
		await report(23, evidence(base - 10_000, 'live', base + 1));
		expect(windows.get(property.id)?.state).toBe('confirmed_grace');
		expect(accepted).toHaveBeenCalledTimes(1);
		expect(values.readQualifiedSample(property, 20_000)?.sampledAt).toEqual(new Date(base - 10_000));
	});

	it('holds the previous command value without qualifying it or replaying it as fresh evidence', async () => {
		open();
		await report(20);
		expect(accepted).not.toHaveBeenCalled();
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('cannot publish an in-flight derived sample after its captured lifecycle closes and a retry reopens authority', async () => {
		let validated = true;
		let generation = 0;
		const guard = { isCurrent: () => validated && generation === 0, reason: 'validation_pending' };
		const lease = producers.register(property, 1, guard);
		await values.publishDerived(property, lease, 20, publication());
		const entered = deferred<void>();
		const release = deferred<void>();
		storage.writePoints.mockImplementationOnce(() => {
			entered.resolve();
			return release.promise;
		});
		const pending = values.publishDerived(property, lease, 21, publication());
		await entered.promise;
		validated = false;
		generation++;
		Object.assign(guard, { isCurrent: () => true, reason: 'mutated' });
		expect(producers.read(property.id)).toMatchObject({ value: null, producer: { reasons: ['validation_pending'] } });
		expect(values.readQualifiedSample(property, 10000)).toBeNull();
		validated = true;
		expect(producers.isAvailable(lease)).toBe(false);
		release.resolve();
		await expect(pending).resolves.toMatchObject({ changed: false, state: { value: null } });
		expect(values.readQualifiedSample(property, 10000)).toBeNull();
		const fresh = producers.register(property, 1, {
			isCurrent: () => validated && generation === 1,
			reason: 'validation_pending',
		});
		await values.publishDerived(property, fresh, 22, publication());
		expect(values.readQualifiedSample(property, 10000)?.value).toBe(22);
	});
	it('serves an initializing overlay instead of old persisted history', async () => {
		storage.query.mockResolvedValue([{ propertyId: property.id, numberValue: 99, time: new Date(base) }]);
		producers.register(property, 1);
		expect(await values.readLatest(property)).toMatchObject({
			value: null,
			producer: { quality: 'unavailable', reasons: ['initializing'] },
		});
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('publishes degraded quality, expires inline, and preserves history on invalidation', async () => {
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 20, {
			...publication(),
			quality: 'degraded',
			reasons: ['missing_member'],
		});
		expect(values.readQualifiedSample(property, 10_000)).toMatchObject({
			value: 20,
			quality: 'degraded',
			reasons: ['missing_member'],
		});
		jest.setSystemTime(base + 10_000);
		expect(await values.readLatestStrict(property)).toMatchObject({
			value: null,
			producer: { quality: 'unavailable', reasons: ['expired'] },
		});
		expect(values.readQualifiedSample(property, 100_000)).toBeNull();
		expect(storage.writePoints).toHaveBeenCalledTimes(1);
		expect(storage.query).not.toHaveBeenCalled();
	});

	it('checks producer expiry on every strict batch and bounded read path', async () => {
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 20, publication());
		jest.setSystemTime(base + 10_000);
		expect((await values.readLatestManyStrict([property])).get(property.id)?.value).toBeNull();
		const bounded = await values.readLatestManyBounded([property]);
		expect(bounded).toMatchObject({ availableCount: 0, missingCount: 1 });
		expect(bounded.items[0].state).toMatchObject({ producer: { quality: 'unavailable' } });
	});

	it('applies producer registration after a bounded storage wait', async () => {
		const query = deferred<Array<{ propertyId: string; numberValue: number; time: Date }>>();
		storage.queryStrict.mockReturnValue(query.promise);
		const reading = values.readLatestManyBounded([property]);
		producers.register(property, 2);
		query.resolve([{ propertyId: property.id, numberValue: 99, time: new Date(base) }]);
		expect((await reading).items[0].state).toMatchObject({
			value: null,
			producer: { revision: 2, quality: 'unavailable' },
		});
	});

	it('keeps two queued valid publications; successful publication does not invalidate the newer one', async () => {
		const lease = producers.register(property, 1);
		jest.setSystemTime(base + 2_000);
		const first = values.publishDerived(property, lease, 20, publication(base, base + 1_000));
		const second = values.publishDerived(property, lease, 21, publication(base + 1_000, base + 2_000));
		await Promise.all([first, second]);
		expect((await values.readLatest(property))?.value).toBe(21);
		expect(storage.writePoints).toHaveBeenCalledTimes(2);
	});

	it('permits changed aggregate values/membership/quality at the same oldest contributing timestamp', async () => {
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 20, publication());
		jest.setSystemTime(base + 1_000);
		await values.publishDerived(property, lease, 21, {
			...publication(),
			quality: 'degraded',
			reasons: ['member_excluded'],
		});
		expect(values.readQualifiedSample(property, 10_000)).toMatchObject({
			value: 21,
			sampledAt: new Date(base),
			quality: 'degraded',
		});
		values.invalidateDerived(property, lease, ['quorum_lost']);
		jest.setSystemTime(base + 2_000);
		await values.publishDerived(property, lease, 22, publication());
		expect((await values.readLatest(property))?.value).toBe(22);
	});

	it('publishes the true oldest contributor when a newer evaluation restores an older member', async () => {
		const lease = producers.register(property, 1);
		jest.setSystemTime(base + 10_000);
		await values.publishDerived(property, lease, 20, publication(base));
		jest.setSystemTime(base + 11_000);
		await values.publishDerived(property, lease, 22, publication(base + 10_000));
		jest.setSystemTime(base + 12_000);
		await values.publishDerived(property, lease, 21, publication(base + 8_000));
		expect(await values.readLatest(property)).toMatchObject({
			value: 21,
			lastUpdated: new Date(base + 8_000).toISOString(),
		});
		expect(storage.writePoints).toHaveBeenCalledTimes(3);
	});

	it('fences older asynchronous evaluations even at identical evaluation clocks', async () => {
		const lease = producers.register(property, 1);
		const old = producers.beginEvaluation(lease);
		const current = producers.beginEvaluation(lease);
		await values.publishDerived(property, lease, 21, publication(), current);
		await values.publishDerived(property, lease, 19, publication(), old);
		expect((await values.readLatest(property))?.value).toBe(21);
	});

	it('invalid computed values revoke only current properly ordered work', async () => {
		const old = producers.register(property, 1);
		const lease = producers.register(property, 2);
		await values.publishDerived(property, lease, 20, publication());
		await values.publishDerived(property, old, NaN, publication());
		await values.publishDerived(property, lease, NaN, publication(base - 1, base - 1));
		expect((await values.readLatest(property))?.value).toBe(20);
		await values.publishDerived(property, lease, NaN, publication());
		expect((await values.readLatest(property))?.producer).toMatchObject({
			quality: 'unavailable',
			reasons: ['invalid_value'],
		});
	});

	it.each(['invalidate', 'dispose', 'remap'] as const)(
		'fences in-flight and queued pre-%s evaluation without historical resurrection',
		async (action) => {
			const lease = producers.register(property, 1);
			const admitted = deferred<void>();
			const release = deferred<void>();
			storage.writePoints.mockImplementation(async () => {
				admitted.resolve(undefined);
				await release.promise;
			});
			const first = values.publishDerived(property, lease, 20, publication());
			await admitted.promise;
			const queued = values.publishDerived(property, lease, 21, publication());
			if (action === 'invalidate') values.invalidateDerived(property, lease, ['source_lost']);
			else if (action === 'dispose') producers.unregister(lease);
			else producers.register(property, 2);
			release.resolve(undefined);
			await Promise.all([first, queued]);
			expect((await values.readLatest(property))?.value).toBeNull();
			expect(storage.writePoints).toHaveBeenCalledTimes(1);
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		},
	);

	it('deep copies producer snapshots and serializes dates with public snake_case fields', async () => {
		const lease = producers.register(property, 3);
		await values.publishDerived(property, lease, 20, { ...publication(), reasons: ['membership_changed'] });
		const state = await values.readLatest(property);
		const copy = clonePropertyValueState(state);
		copy.producer.reasons.push('mutated');
		expect((await values.readLatest(property))?.producer.reasons).toEqual(['membership_changed']);
		expect(instanceToPlain(state)).toMatchObject({
			producer: {
				sampled_at: new Date(base).toISOString(),
				evaluated_at: new Date(base).toISOString(),
				expires_at: new Date(base + 10_000).toISOString(),
				revision: 3,
			},
		});
	});

	it('serves opt-in strict and batch initializing state with storage disconnected', async () => {
		storage.isConnected.mockReturnValue(false);
		producers.register(property, 1);
		expect(await values.readLatestStrict(property)).toMatchObject({
			value: null,
			producer: { quality: 'unavailable' },
		});
		expect((await values.readLatestManyStrict([property])).get(property.id)).toMatchObject({
			value: null,
			producer: { quality: 'unavailable' },
		});
		expect((await values.readLatestManyBounded([property])).items[0].state).toMatchObject({
			value: null,
			producer: { quality: 'unavailable' },
		});
	});

	it.each(['latest', 'strict'] as const)(
		'applies initializing state registered while %s storage read is pending',
		async (kind) => {
			const query = deferred<Array<{ propertyId: string; numberValue: number; time: Date }>>();
			storage.query.mockReturnValue(query.promise);
			storage.queryStrict.mockReturnValue(query.promise);
			const reading = kind === 'latest' ? values.readLatest(property) : values.readLatestStrict(property);
			producers.register(property, 4);
			query.resolve([{ propertyId: property.id, numberValue: 99, time: new Date(base) }]);
			expect(await reading).toMatchObject({ value: null, producer: { quality: 'unavailable', revision: 4 } });
		},
	);

	it('rechecks expiry of an earlier cache hit after a strict batch storage wait', async () => {
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 20, publication());
		const cold = Object.assign(new SampleProperty(), property, { id: 'cold' });
		const query = deferred<Array<{ propertyId: string; numberValue: number; time: Date }>>();
		storage.queryStrict.mockReturnValue(query.promise);
		const reading = values.readLatestManyStrict([property, cold]);
		jest.setSystemTime(base + 10_000);
		query.resolve([{ propertyId: cold.id, numberValue: 99, time: new Date(base) }]);
		expect((await reading).get(property.id)).toMatchObject({
			value: null,
			producer: { quality: 'unavailable', reasons: ['expired'] },
		});
	});

	it('rechecks expiry of an earlier cache hit after a bounded storage wait', async () => {
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 20, publication());
		const cold = Object.assign(new SampleProperty(), property, { id: 'cold' });
		const query = deferred<Array<{ propertyId: string; numberValue: number; time: Date }>>();
		storage.queryStrict.mockReturnValue(query.promise);
		const reading = values.readLatestManyBounded([property, cold]);
		jest.setSystemTime(base + 10_000);
		query.resolve([{ propertyId: cold.id, numberValue: 99, time: new Date(base) }]);
		expect((await reading).items[0].state).toMatchObject({
			value: null,
			producer: { quality: 'unavailable', reasons: ['expired'] },
		});
	});

	it('does not let generic writers mutate an owned producer series', async () => {
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 20, publication());
		await values.write(property, 99);
		await report(99);
		expect((await values.readLatest(property))?.value).toBe(20);
		expect(storage.writePoints).toHaveBeenCalledTimes(1);
		expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
	});

	it('isolates notification timestamps from listeners that mutate Date objects', async () => {
		events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, (payload: { sample: { sampledAt: Date } }) =>
			payload.sample.sampledAt.setTime(0),
		);
		await report(20);
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt).toEqual(new Date(base));
	});

	it('rejects future-clock samples and stale invalid evaluations without revoking newer derived state', async () => {
		await report(20, evidence(base + 1_000));
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		expect(accepted).not.toHaveBeenCalled();
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 21, publication());
		expect(values.invalidateDerived(property, lease, ['late_error'], new Date(base - 1))).toBe(false);
		expect(values.invalidateDerived(property, lease, ['clock_error'], new Date(base + 1))).toBe(false);
		expect((await values.readLatest(property))?.value).toBe(21);
	});

	it('publishes exactly one unchanged command confirmation without adding an energy/history measurement', async () => {
		await report(20);
		open(20);
		jest.setSystemTime(base + 1_000);
		scalar.mockClear();
		accepted.mockClear();
		storage.enqueueWritePoint.mockClear();
		await report(20, evidence(base + 1_000, 'live', base + 1));
		await report(20, evidence(base + 1_000, 'live', base + 1));
		expect(windows.get(property.id)?.state).toBe('confirmed_grace');
		expect(accepted).toHaveBeenCalledTimes(2);
		expect(scalar).toHaveBeenCalledTimes(1);
		expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
	});

	it('respects expiry at the explicit consumer evaluation clock', async () => {
		const lease = producers.register(property, 1);
		await values.publishDerived(property, lease, 20, publication());
		expect(values.readQualifiedSample(property, 100_000, new Date(base + 10_000))).toBeNull();
	});

	it('captures queued evaluation evidence and publishes immutable producer snapshots', async () => {
		const lease = producers.register(property, 1);
		const gate = deferred<void>();
		storage.flushQueuedWrites.mockReturnValue(gate.promise);
		const input = { ...publication(), reasons: ['original'] };
		const pending = values.publishDerived(property, lease, 20, input);
		input.sampledAt.setTime(base - 1_000);
		input.evaluatedAt.setTime(base + 2_000);
		input.reasons.push('mutated');
		gate.resolve(undefined);
		await pending;
		const state = await values.readLatest(property);
		expect(state.producer).toMatchObject({ sampledAt: new Date(base).toISOString(), reasons: ['original'] });
		const lastCall: unknown = quality.mock.calls.at(-1);
		const event = (lastCall as [ChannelPropertyEntity])[0];
		expect(Object.isFrozen(event)).toBe(true);
		expect(Object.isFrozen(event.value)).toBe(true);
		expect(Object.isFrozen(event.value.producer.reasons)).toBe(true);
	});

	it.each([null, -999, NaN, Infinity, 151])(
		'revokes active-window qualification on fault %s without observation evidence or command acknowledgement',
		async (fault) => {
			await report(20);
			open();
			jest.setSystemTime(base + 1_000);
			await report(fault, { ...evidence(base + 1_000), observedAt: undefined });
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
			expect((await values.readLatest(property))?.value).toBe(20);
			expect(windows.get(property.id)?.state).toBe('pending');
			expect(invalidated).toHaveBeenCalledTimes(1);
			expect(accepted).toHaveBeenCalledTimes(1);
			expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(1);
		},
	);

	it('does not revoke a newer live sample with an old active-window fault', async () => {
		jest.setSystemTime(base + 1_000);
		await report(20, evidence(base + 1_000));
		open();
		await report(null, { ...evidence(base), observedAt: undefined });
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
		expect(windows.get(property.id)?.state).toBe('pending');
		expect(invalidated).not.toHaveBeenCalled();
	});

	const clockFaults: Array<{ name: string; evidence: () => PropertySampleEvidence }> = [
		{ name: 'future measurement', evidence: () => evidence(base + 3_600_000) },
		{ name: 'nonfinite measurement', evidence: () => evidence(Number.NaN) },
		{ name: 'malformed receipt', evidence: () => ({ ...evidence(), receivedAt: new Date(Number.NaN) }) },
		{ name: 'future receipt', evidence: () => ({ ...evidence(), receivedAt: new Date(base + 3_600_000) }) },
		{ name: 'measurement after receipt', evidence: () => ({ ...evidence(), receivedAt: new Date(base - 1) }) },
	];

	describe.each(['admitted writer', 'channel report'] as const)('clock recovery through %s', (boundary) => {
		const write = (value: number | null, sampleEvidence: PropertySampleEvidence) =>
			boundary === 'channel report'
				? report(value, sampleEvidence)
				: values.writeSampleWithState(property, value, sampleEvidence);

		it.each(clockFaults)('revokes $name without poisoning corrected coarse-clock recovery', async (fault) => {
			await write(20, evidence());
			await write(21, fault.evidence());
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
			expect((await values.readLatest(property))?.value).toBe(20);
			expect(invalidated).toHaveBeenCalledTimes(1);
			await write(99, evidence(base, 'cached'));
			await write(99, evidence(base, 'retained'));
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
			expect((await values.readLatest(property))?.value).toBe(20);
			await write(22, evidence());
			expect(values.readQualifiedSample(property, 10_000)).toMatchObject({ value: 22, sampledAt: new Date(base) });
			expect((await values.readLatest(property))?.value).toBe(22);
			expect(accepted).toHaveBeenCalledTimes(2);
			expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(2);
		});

		it('does not let clock errors clear an equal-time genuine value-fault tombstone', async () => {
			await write(20, evidence());
			await write(null, evidence());
			await write(21, evidence(base + 3_600_000));
			await write(22, evidence());
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
			jest.setSystemTime(base + 1);
			await write(22, evidence(base + 1));
			expect(values.readQualifiedSample(property, 10_000)?.value).toBe(22);
		});

		it('fences cached replay even when the first live clock evidence was nonfinite', async () => {
			await write(21, evidence(Number.NaN));
			await write(99, evidence(base, 'cached'));
			await write(99, evidence(base, 'retained'));
			expect(accepted).not.toHaveBeenCalled();
			expect(await values.readLatest(property)).toBeNull();
			await write(22, evidence());
			expect(values.readQualifiedSample(property, 10_000)?.value).toBe(22);
		});

		it('does not let older malformed-clock faults revoke a newer trusted sample', async () => {
			jest.setSystemTime(base + 1_000);
			await write(20, evidence(base + 1_000));
			await write(null, { ...evidence(base), receivedAt: new Date(Number.NaN) });
			expect(values.readQualifiedSample(property, 10_000)?.value).toBe(20);
			expect(invalidated).not.toHaveBeenCalled();
		});
	});

	it.each(['measurement', 'receipt'] as const)(
		'excludes future physical %s evidence after the server clock moves backwards',
		async (clock) => {
			jest.setSystemTime(base + 1_000);
			await report(20, evidence(clock === 'measurement' ? base + 1_000 : base));
			jest.setSystemTime(base + 500);
			expect(values.readQualifiedSample(property, 10_000)).toBeNull();
			expect((await values.readLatest(property))?.value).toBe(20);
			await report(22, evidence(clock === 'measurement' ? base + 1_000 : base));
			expect(values.readQualifiedSample(property, 10_000)?.value).toBe(clock === 'measurement' ? undefined : 22);
		},
	);

	it('revokes derived future evaluation authority on clock rollback and accepts a corrected evaluation', async () => {
		const lease = producers.register(property, 1);
		jest.setSystemTime(base + 1_000);
		await values.publishDerived(property, lease, 20, publication(base));
		jest.setSystemTime(base + 500);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		expect(await values.readLatestStrict(property)).toMatchObject({
			value: null,
			producer: { quality: 'unavailable', reasons: ['clock_invalid'] },
		});
		await values.publishDerived(property, lease, 21, publication(base, base + 1_000));
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		await values.publishDerived(property, lease, 22, publication(base));
		expect(values.readQualifiedSample(property, 10_000)?.value).toBe(22);
	});

	it.each(['publish', 'invalidate', 'expiry', 'clock rollback'] as const)(
		'keeps updated catalog metadata when emitting derived %s state',
		async (action) => {
			producers.onModuleInit();
			const lease = producers.register(property, 1);
			await values.publishDerived(property, lease, 20, publication());
			const updated = Object.assign(new SampleProperty(), property, {
				name: 'renamed sensor',
				identifier: 'updated-temperature',
				format: [-50, 100],
				permissions: ['read'],
				invalid: -100,
				step: 0.25,
				unit: '°C',
				updatedAt: new Date(base + 1_000),
			});
			events.emit(EventType.CHANNEL_PROPERTY_UPDATED, updated);
			expect(producers.isCurrent(lease)).toBe(true);
			quality.mockClear();
			if (action === 'publish') await values.publishDerived(property, lease, 21, publication());
			else if (action === 'invalidate') producers.invalidate(lease, ['source_lost']);
			else {
				jest.setSystemTime(action === 'expiry' ? base + 10_000 : base - 1);
				producers.sweep();
			}
			expect(quality).toHaveBeenCalledTimes(1);
			const [snapshot] = quality.mock.calls[0] as unknown as [ChannelPropertyEntity];
			expect(snapshot).toMatchObject({
				name: updated.name,
				identifier: updated.identifier,
				format: updated.format,
				permissions: updated.permissions,
				invalid: updated.invalid,
				step: updated.step,
				unit: updated.unit,
				updatedAt: updated.updatedAt,
			});
			expect(Object.isFrozen(snapshot)).toBe(true);
		},
	);

	it('uses one unref expiry timer and cleans it up with module disposal', () => {
		const interval = jest.spyOn(global, 'setInterval');
		producers.onModuleInit();
		producers.onModuleInit();
		expect(interval).toHaveBeenCalledTimes(1);
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_UPDATED)).toBe(1);
		producers.onModuleDestroy();
		expect(jest.getTimerCount()).toBe(0);
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_UPDATED)).toBe(0);
	});
});
