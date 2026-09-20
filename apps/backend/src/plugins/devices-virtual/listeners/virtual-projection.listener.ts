import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

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
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualProjectionListener');

	constructor(
		private readonly index: VirtualPropertyIndexService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	@OnEvent(EventType.CHANNEL_PROPERTY_VALUE_SET)
	handlePropertyValueSet(property: ChannelPropertyEntity): void {
		const projections = this.index.findBySourceProperty(property.id);

		if (projections.length === 0) {
			return;
		}

		for (const projection of projections) {
			// The value itself is already shared — both properties resolve to the same storage key,
			// so the projection carries the source's state without a second read.
			projection.value = property.value;

			this.eventEmitter.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, projection);
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
