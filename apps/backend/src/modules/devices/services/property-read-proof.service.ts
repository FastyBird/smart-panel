import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { AcceptedPropertySample } from '../models/property-sample.model';

import { PlatformRegistryService } from './platform.registry.service';

export interface PropertyReadProofTarget {
	readonly device: DeviceEntity;
	readonly channel: ChannelEntity;
	readonly property: ChannelPropertyEntity;
}

export type PropertyReadProofOutcome =
	| Readonly<{ status: 'reported'; sample: AcceptedPropertySample; requested: boolean }>
	| Readonly<{ status: 'timed_out'; requested: boolean }>
	| Readonly<{ status: 'cancelled'; requested: boolean }>;

export interface PropertyReadProofOptions {
	/** How long to wait for the report. */
	readonly timeoutMs: number;
	/** Stops waiting, for example when the caller's own state moved on. */
	readonly signal?: AbortSignal;
}

/**
 * Proves a property's current device state by the first device report received after the call.
 *
 * The platform is asked for a fresh read when it supports one. Without that support the proof waits for
 * the device's next report or poll, so every plugin can be used. A command acknowledgement (`commandEcho`),
 * a replay of earlier state, a non-live sample and anything received before the call never count: they
 * show what Smart Panel asked for or what the device said earlier, not what the device reports now.
 */
@Injectable()
export class PropertyReadProofService {
	constructor(
		private readonly platformRegistry: PlatformRegistryService,
		private readonly events: EventEmitter2,
	) {}

	observeNextReport(
		target: PropertyReadProofTarget,
		options: PropertyReadProofOptions,
	): Promise<PropertyReadProofOutcome> {
		const propertyId = target.property.id;
		const notBefore = Date.now();
		let requested = false;

		return new Promise<PropertyReadProofOutcome>((resolve) => {
			let settled = false;
			const finish = (outcome: PropertyReadProofOutcome): void => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				this.events.off(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, onSample);
				options.signal?.removeEventListener('abort', onAbort);
				resolve(outcome);
			};
			const onSample = (payload?: { propertyId?: string; sample?: AcceptedPropertySample }): void => {
				const sample = payload?.sample;
				if (payload?.propertyId !== propertyId || !sample) return;
				if (sample.provenance !== 'live' || sample.replay === true || sample.commandEcho === true) return;
				if (sample.receivedAt.getTime() < notBefore) return;
				finish(Object.freeze({ status: 'reported', sample, requested }));
			};
			const onAbort = (): void => finish(Object.freeze({ status: 'cancelled', requested }));
			const timer = setTimeout(
				() => finish(Object.freeze({ status: 'timed_out', requested })),
				Math.max(0, options.timeoutMs),
			);

			if (options.signal?.aborted) {
				onAbort();
				return;
			}
			options.signal?.addEventListener('abort', onAbort, { once: true });
			this.events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, onSample);

			void this.platformRegistry.requestPropertyRead(target.device, target.channel, target.property).then((sent) => {
				requested = sent;
			});
		});
	}
}
