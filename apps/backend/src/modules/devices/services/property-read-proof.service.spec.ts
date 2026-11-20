import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { AcceptedPropertySample } from '../models/property-sample.model';
import { IDevicePlatform, PropertyReadRequest } from '../platforms/device.platform';

import { PlatformRegistryService } from './platform.registry.service';
import { PropertyReadProofService } from './property-read-proof.service';
import { nextSampleIngress } from './property-sample-ingress';

/** Stand-in for any device plugin: proof must not depend on which plugins exist. */
const stubPlatform = (type: string, read?: IDevicePlatform['requestPropertyRead']): IDevicePlatform => ({
	getType: () => type,
	process: () => Promise.resolve(true),
	processBatch: () => Promise.resolve(true),
	...(read ? { requestPropertyRead: read } : {}),
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe('PropertyReadProofService', () => {
	let events: EventEmitter2;
	let registry: PlatformRegistryService;
	let proof: PropertyReadProofService;
	let request: PropertyReadRequest | null;
	let read: jest.Mock<Promise<boolean>, [PropertyReadRequest]>;
	const channel = { id: 'channel' } as ChannelEntity;
	const property = { id: 'output' } as ChannelPropertyEntity;
	const target = (type: string) => ({ device: { id: 'device', type } as DeviceEntity, channel, property });
	/** A sample that arrives now (its arrival number is taken now) and is accepted now. */
	const arrive = (sample: Partial<AcceptedPropertySample> = {}): Partial<AcceptedPropertySample> => ({
		ingressSequence: nextSampleIngress(),
		...sample,
	});
	const accept = (sample: Partial<AcceptedPropertySample>, propertyId = property.id): void => {
		events.emit(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, {
			propertyId,
			sample: {
				propertyId,
				value: false,
				sampledAt: new Date(),
				receivedAt: new Date(),
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
		jest.useFakeTimers();
		events = new EventEmitter2();
		registry = new PlatformRegistryService();
		request = null;
		read = jest.fn<Promise<boolean>, [PropertyReadRequest]>((received) => {
			request = received;
			received.dispatching();
			return Promise.resolve(true);
		});
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
		expect(request).toMatchObject({ device: target('with-read').device, channel, property });
		accept(arrive({ value: false }));
		await expect(result).resolves.toMatchObject({ status: 'reported', read: 'sent', sample: { value: false } });
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)).toBe(0);
	});

	it('works with a platform without read support by waiting for its next report', async () => {
		const result = proof.observeNextReport(target('without-read'), { timeoutMs: 5_000 });
		await flush();
		accept(arrive({ value: true }));
		await expect(result).resolves.toMatchObject({ status: 'reported', read: 'not_sent', sample: { value: true } });
	});

	it.each<[string, Partial<AcceptedPropertySample>]>([
		['a command acknowledgement', { commandEcho: true }],
		['a replay', { replay: true }],
		['a cached sample', { provenance: 'cached' }],
		['a sample without an arrival number', { ingressSequence: undefined }],
	])('never counts %s', async (_label, sample) => {
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		accept(arrive(sample));
		accept(arrive({ value: false }), 'another-property');
		accept(arrive({ value: true }));
		await expect(result).resolves.toMatchObject({ status: 'reported', sample: { value: true } });
	});

	it('never counts a report that arrived before the call but is accepted after it', async () => {
		const early = arrive({ value: false });
		const result = proof.observeNextReport(target('without-read'), { timeoutMs: 5_000 });
		await flush();
		accept(early);
		accept(arrive({ value: true }));
		await expect(result).resolves.toMatchObject({ status: 'reported', sample: { value: true } });
	});

	it('ignores reports while the platform settles earlier commands, and counts only those after dispatch', async () => {
		const sent = deferred<boolean>();
		read.mockImplementationOnce((received) => {
			request = received;
			return sent.promise;
		});
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		// An unmarked acknowledgement of an earlier command, received while the platform waits.
		accept(arrive({ value: false }));
		await flush();
		request?.dispatching();
		const answer = arrive({ value: true });
		accept(answer);
		sent.resolve(true);
		await expect(result).resolves.toMatchObject({ status: 'reported', sample: { value: true } });
	});

	it('reports a pending read on timeout instead of claiming it was not sent', async () => {
		read.mockImplementationOnce(() => new Promise<boolean>(() => undefined));
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		jest.advanceTimersByTime(5_000);
		await expect(result).resolves.toEqual({ status: 'timed_out', read: 'pending' });
	});

	it('waits for a report after the failure is known when the read could not be sent', async () => {
		read.mockRejectedValueOnce(new Error('offline'));
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		accept(arrive({ value: false }));
		await expect(result).resolves.toMatchObject({ status: 'reported', read: 'not_sent', sample: { value: false } });
	});

	it('times out without a report and stops listening', async () => {
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000 });
		await flush();
		jest.advanceTimersByTime(5_000);
		await expect(result).resolves.toEqual({ status: 'timed_out', read: 'sent' });
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)).toBe(0);
	});

	it('stops waiting when cancelled', async () => {
		const controller = new AbortController();
		const result = proof.observeNextReport(target('with-read'), { timeoutMs: 5_000, signal: controller.signal });
		controller.abort();
		await expect(result).resolves.toMatchObject({ status: 'cancelled' });
		expect(events.listenerCount(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)).toBe(0);

		const aborted = new AbortController();
		aborted.abort();
		await expect(
			proof.observeNextReport(target('with-read'), { timeoutMs: 5_000, signal: aborted.signal }),
		).resolves.toEqual({ status: 'cancelled', read: 'not_sent' });
		// Only the first observation asked for a read; the already-cancelled one never did.
		expect(read).toHaveBeenCalledTimes(1);
	});
});
