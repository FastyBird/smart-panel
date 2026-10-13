import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { clonePropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';
import { isEligibleVirtualMeasurement } from '../services/virtual-source-eligibility.utils';

/** Create a shallow snapshot with the prototype needed by entity serialization. */
const detachedClone = <T extends object>(value: T): T => {
	const clone = Object.create(Reflect.getPrototypeOf(value)) as T;

	return Object.assign(clone, value);
};

const VALUE_STATE_CHANGED_EVENT = EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED;

/**
 * A source write emits a value event carrying the *source* property's id, which the WebSocket
 * gateway rebroadcasts verbatim. Clients holding a virtual property would never see their own
 * property change, so re-emit one event per projection.
 *
 * Nesting is rejected at creation, so a virtual property is never anyone's source: the index
 * lookup returns empty for the events this listener itself emits, and recursion terminates.
 * Enforced by SourceNotVirtualConstraintValidator (../validators/source-not-virtual-constraint.validator.ts)
 * on `source_property` in both the create and update channel-property DTOs.
 */
@Injectable()
export class VirtualProjectionListener {
	private readonly activeProperties = new Set<string>();
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualProjectionListener');

	constructor(
		private readonly index: VirtualPropertyIndexService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	@OnEvent(EventType.CHANNEL_PROPERTY_VALUE_SET)
	handlePropertyValueSet(property: ChannelPropertyEntity): void {
		this.projectValueSnapshot(property, EventType.CHANNEL_PROPERTY_VALUE_SET);
	}

	@OnEvent(VALUE_STATE_CHANGED_EVENT)
	handlePropertyValueStateChanged(property: ChannelPropertyEntity): void {
		this.projectValueSnapshot(property, VALUE_STATE_CHANGED_EVENT);
	}

	private projectValueSnapshot(property: ChannelPropertyEntity, event: string): void {
		if (this.activeProperties.has(property.id) || this.activeProperties.size >= 16) return;
		if (property.type === 'virtual') {
			const channel = typeof property.channel === 'string' ? null : property.channel;
			const device = channel && typeof channel.device !== 'string' ? channel.device : null;
			if (!channel || !device || !isEligibleVirtualMeasurement(property, channel, device)) return;
		}
		const projections = this.index.findBySourceProperty(property.id);

		if (projections.length === 0) {
			return;
		}

		this.activeProperties.add(property.id);
		try {
			for (const projection of projections) {
				if (this.activeProperties.has(projection.id)) continue;
				// The index retains hydrated entities, so mutating one here makes already-emitted events
				// change under deferred consumers. Preserve the entity prototype for serialization, while
				// detaching both the entity and its mutable value state from the indexed/source objects.
				const snapshot = Object.assign(detachedClone(projection), {
					value: property.value ? clonePropertyValueState(property.value) : null,
				});

				this.eventEmitter.emit(event, snapshot);
			}
		} finally {
			this.activeProperties.delete(property.id);
		}

		this.logger.debug(`Projected value of property id=${property.id} to ${projections.length} virtual properties`);
	}

	@OnEvent(EventType.CHANNEL_INPUT_OCCURRENCE)
	handleChannelInputOccurrence(occurrence: ChannelInputOccurrencePayload): void {
		// Prevent loops: if the incoming occurrence is already a projection, do not project again
		if (
			typeof occurrence.data?.projection === 'object' &&
			occurrence.data.projection !== null &&
			'originalOccurrenceId' in occurrence.data.projection
		) {
			return;
		}

		const projections = this.index.findBySourceProperty(occurrence.propertyId);

		if (projections.length === 0) {
			return;
		}

		for (const projection of projections) {
			const channel = projection.channel;
			if (!channel || typeof channel === 'string') {
				continue;
			}

			const virtualDeviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;

			if (!virtualDeviceId || !channel.id) {
				continue;
			}

			const deviceCategory = typeof channel.device !== 'string' ? channel.device?.category : undefined;

			const projectedOccurrence: ChannelInputOccurrencePayload = {
				id: uuidv4(),
				deviceId: virtualDeviceId,
				channelId: channel.id,
				propertyId: projection.id,
				channelCategory: channel.category,
				propertyCategory: projection.category,
				deviceCategory,
				event: occurrence.event,
				timestamp: new Date().toISOString(),
				sourceTimestamp: occurrence.sourceTimestamp ?? occurrence.timestamp,
				sourceOccurrenceId: occurrence.sourceOccurrenceId ?? occurrence.id,
				nativeEventType: occurrence.nativeEventType,
				integration: occurrence.integration,
				endpoint: occurrence.endpoint,
				data: {
					...(occurrence.data ?? {}),
					projection: {
						originalOccurrenceId: occurrence.id,
						sourceDeviceId: occurrence.deviceId,
						sourceChannelId: occurrence.channelId,
						sourcePropertyId: occurrence.propertyId,
					},
				},
			};

			this.eventEmitter.emit(EventType.CHANNEL_INPUT_OCCURRENCE, projectedOccurrence);
		}

		this.logger.debug(
			`Projected input occurrence event=${occurrence.event} from property id=${occurrence.propertyId} to ${projections.length} virtual properties`,
		);
	}
}
