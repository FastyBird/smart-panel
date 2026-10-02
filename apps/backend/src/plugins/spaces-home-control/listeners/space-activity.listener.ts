import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType as DevicesEventType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { SpaceActivityService } from '../../../modules/spaces/services/space-activity.service';
import { SPACES_MODULE_NAME } from '../../../modules/spaces/spaces.constants';

@Injectable()
export class SpaceActivityListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceActivityListener');

	constructor(
		private readonly propertyMetadata: PropertyMetadataService,
		private readonly activity: SpaceActivityService,
	) {}

	onModuleInit() {
		this.logger.debug('Space activity listener initialized');
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	async handlePropertyUpdated(property: ChannelPropertyEntity): Promise<void> {
		const observedAt = new Date();
		const generation = this.activity.getGeneration();
		try {
			if (!property.id) return;
			// The shared structural catalog is invalidated on device moves, property remaps and deletion.
			// Do not query the channel or write a space row for every ordinary value notification.
			const metadata = await this.propertyMetadata.findOne(property.id);
			const channel = metadata?.channel;
			if (!channel || typeof channel === 'string') return;
			const device = channel.device;
			if (!device || typeof device === 'string' || !device.roomId) return;
			this.activity.record(device.roomId, observedAt, generation);
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to update space activity on property update: ${err.message}`, err.stack);
		}
	}
}
