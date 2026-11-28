import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { AcceptedPropertySample } from '../models/property-sample.model';

import { PlatformRegistryService } from './platform.registry.service';
import { currentSampleIngress } from './property-sample-ingress';

export interface PropertyReadProofTarget {
	readonly device: DeviceEntity;
	readonly channel: ChannelEntity;
	readonly property: ChannelPropertyEntity;
}

/**
 * Whether a fresh read was sent: `pending` until the platform's request settles (a report may answer a read
 * the platform marked as dispatching before its request settled).
 */
export type PropertyReadDispatch = 'sent' | 'not_sent' | 'pending';

export type PropertyReadProofOutcome =
	| Readonly<{ status: 'reported'; sample: AcceptedPropertySample; read: PropertyReadDispatch }>
	| Readonly<{ status: 'timed_out' | 'cancelled'; read: PropertyReadDispatch }>;

/** A caller may own the wait through an AbortSignal for devices with infrequent unsolicited reports. */
export type PropertyReadProofOptions = (
	| { readonly timeoutMs: number; readonly signal?: AbortSignal }
	| { readonly timeoutMs?: undefined; readonly signal: AbortSignal }
) & {
	/** Discard a delayed observation known to have been measured before this action began. */
	readonly minimumSampledAt?: Date;
	/** If no read is dispatched, recover a current unsolicited report received during the preceding action. */
	readonly unsolicited?: {
		readonly afterIngress: number;
		readonly latest: () => AcceptedPropertySample | null;
	};
};

/**
 * Proves a property's current device state by the first device report that arrives after a boundary.
 *
 * The platform is asked for a fresh read when it supports one; the boundary is the moment it sends the read
 * (after settling earlier commands). If no read is dispatched, the caller can supply the preceding action's
 * ingress boundary. Otherwise the wait starts when the platform declines the read. Command acknowledgements,
 * replays, non-live samples and reports received before the applicable boundary never count.
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
		const minimumSampledAt = options.minimumSampledAt?.getTime();
		let read: PropertyReadDispatch = 'pending';
		/** Arrival number after which a report counts; none counts until it is known. */
		let boundary: number | null = null;

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
				if (boundary === null || payload?.propertyId !== propertyId || sample?.propertyId !== propertyId) return;
				if (sample.provenance !== 'live' || sample.replay === true || sample.commandEcho === true) return;
				if (!Number.isSafeInteger(sample.ingressSequence) || sample.ingressSequence <= boundary) return;
				if (
					minimumSampledAt !== undefined &&
					!(sample.sampledAt instanceof Date && sample.sampledAt.getTime() >= minimumSampledAt)
				)
					return;
				finish(Object.freeze({ status: 'reported', sample, read }));
			};
			const onAbort = (): void => finish(Object.freeze({ status: 'cancelled', read }));
			const timer =
				options.timeoutMs === undefined
					? undefined
					: setTimeout(() => finish(Object.freeze({ status: 'timed_out', read })), Math.max(0, options.timeoutMs));

			if (options.signal?.aborted) {
				read = 'not_sent';
				onAbort();
				return;
			}
			options.signal?.addEventListener('abort', onAbort, { once: true });
			this.events.on(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED, onSample);

			void this.platformRegistry
				.requestPropertyRead({
					...target,
					dispatching: () => {
						boundary ??= currentSampleIngress();
					},
				})
				.then((sent) => {
					if (settled) return;
					read = sent ? 'sent' : 'not_sent';
					if (!sent && options.unsolicited) {
						// A marked read can still fail to send. The command may already have elicited the only report.
						boundary = options.unsolicited.afterIngress;
						const sample = options.unsolicited.latest();
						if (sample) onSample({ propertyId, sample });
					} else {
						boundary ??= currentSampleIngress();
					}
				})
				.catch(() => finish(Object.freeze({ status: 'cancelled', read })));
		});
	}
}
