import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { AcceptedPropertySample } from '../models/property-sample.model';
import { IDevicePlatform } from '../platforms/device.platform';

import { PlatformRegistryService } from './platform.registry.service';
import { PropertyReadProofService } from './property-read-proof.service';

/** Stand-in for any device plugin: proof must not depend on which plugins exist. */
const stubPlatform = (type: string, read?: IDevicePlatform['requestPropertyRead']): IDevicePlatform => ({
	getType: () => type,
	process: () => Promise.resolve(true),
	processBatch: () => Promise.resolve(true),
	...(read ? { requestPropertyRead: read } : {}),
});

describe('PropertyReadProofService', () => {
	const base = Date.parse('2026-11-20T10:00:00Z');
	let events: EventEmitter2;
	let registry: PlatformRegistryService;
	let proof: PropertyReadProofService;
	let read: jest.Mock<Promise<boolean>, Parameters<NonNullable<IDevicePlatform['requestPropertyRead']>>>;
	const channel = { id: 'channel' } as ChannelEntity;
	const property = { id: 'output' } as ChannelPropertyEntity;
	const target = (type: string) => ({ device: { id: 'device', type } as DeviceEntity, channel, property });
	const emit = (sample: Partial<AcceptedPropertySample>, propertyId = property.id): void => {
		events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, {
			propertyId,
			sample: {
				propertyId,
				value: false,
				sampledAt: new Date(Date.now()),
				receivedAt: new Date(Date.now()),
				provenance: 'live',
				quality: 'good',
				reasons: [],
				...sample,
			},
		});
	};
	const flush = async (): Promise<void> => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
	};

	beforeEach(() => {
		jest.useFakeTimers({ now: base });
		events = new EventEmitter2();
		registry = new PlatformRegistryService();
		read = jest.fn<Promise<boolean>, Parameters<NonNullable<IDevicePlatform['requestPropertyRead']>>>(() =>
			Promise.resolve(true),
		);
		registry.register(stubPlatform('with-read', read));
		registry.register(stubPlatform('without-read'));
		proof = new PropertyReadProofService(registry, events);
	});
	afterEach(() => {
		registry.onModuleDestroy();
		jest.useRealTimers();
	});

	it('asks a platform that supports it for a fresh read and resolves with the next report', async () => {
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		expect(read).toHaveBeenCalledWith({ device: target('with-read').device, channel, property });
		emit({ value: false });
		await expect(result).resolves.toMatchObject({ status: 'reported', requested: true, sample: { value: false } });
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)).toBe(0);
	});

	it('works with a platform without read support by waiting for its next report', async () => {
		const result = proof.observeNextReport(target('without-read'), { timeoutMs: 5_000 });
		await flush();
		emit({ value: true });
		await expect(result).resolves.toMatchObject({ status: 'reported', requested: false, sample: { value: true } });
	});

	it.each<[string, Partial<AcceptedPropertySample>]>([
		['a command acknowledgement', { commandEcho: true }],
		['a replay', { replay: true }],
		['a cached sample', { provenance: 'cached' }],
		['a sample received before the request', { receivedAt: new Date(base - 1) }],
	])('never counts %s', async (_label, sample) => {
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		emit(sample);
		emit({ value: false }, 'another-property');
		jest.setSystemTime(base + 10);
		emit({ value: true, receivedAt: new Date(base + 10) });
		await expect(result).resolves.toMatchObject({ status: 'reported', sample: { value: true } });
	});

	it('times out without a report, and treats a failing read request as not requested', async () => {
		read.mockRejectedValueOnce(new Error('offline'));
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		jest.advanceTimersByTime(5_000);
		await expect(result).resolves.toEqual({ status: 'timed_out', requested: false });
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)).toBe(0);
	});

	it('stops waiting when cancelled', async () => {
		const controller = new AbortController();
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000, signal: controller.signal });
		controller.abort();
		await expect(result).resolves.toMatchObject({ status: 'cancelled' });
		emit({ value: false });
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)).toBe(0);

		const aborted = new AbortController();
		aborted.abort();
		await expect(
			proof.observeNextReport(target('with-read'), { timeoutMs: 5_000, signal: aborted.signal }),
		).resolves.toMatchObject({ status: 'cancelled' });
	});
});
