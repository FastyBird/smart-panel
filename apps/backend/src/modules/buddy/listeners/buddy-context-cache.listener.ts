import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { IntentEventType } from '../../intents/intents.constants';
import { EventType as ScenesEventType } from '../../scenes/scenes.constants';
import { EventType as SpacesEventType } from '../../spaces/spaces.constants';
import { EventType as WeatherEventType } from '../../weather/weather.constants';
import { BUDDY_MODULE_NAME } from '../buddy.constants';
import { BuddyContextService } from '../services/buddy-context.service';

@Injectable()
export class BuddyContextCacheListener {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddyContextCacheListener');

	constructor(private readonly contextService: BuddyContextService) {}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	handleDevicePropertyValueSet(): void {
		this.invalidate('device property value changed');
	}

	@OnEvent(DevicesEventType.DEVICE_CREATED)
	handleDeviceCreated(): void {
		this.invalidate('device created');
	}

	@OnEvent(DevicesEventType.DEVICE_UPDATED)
	handleDeviceUpdated(): void {
		this.invalidate('device updated');
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	handleDeviceDeleted(): void {
		this.invalidate('device deleted');
	}

	@OnEvent(ScenesEventType.SCENE_CREATED)
	handleSceneCreated(): void {
		this.invalidate('scene created');
	}

	@OnEvent(ScenesEventType.SCENE_UPDATED)
	handleSceneUpdated(): void {
		this.invalidate('scene updated');
	}

	@OnEvent(ScenesEventType.SCENE_DELETED)
	handleSceneDeleted(): void {
		this.invalidate('scene deleted');
	}

	@OnEvent(SpacesEventType.SPACE_CREATED)
	handleSpaceCreated(): void {
		this.invalidate('space created');
	}

	@OnEvent(SpacesEventType.SPACE_UPDATED)
	handleSpaceUpdated(): void {
		this.invalidate('space updated');
	}

	@OnEvent(SpacesEventType.SPACE_DELETED)
	handleSpaceDeleted(): void {
		this.invalidate('space deleted');
	}

	@OnEvent(WeatherEventType.WEATHER_INFO)
	handleWeatherInfo(): void {
		this.invalidate('weather info refreshed');
	}

	@OnEvent(IntentEventType.COMPLETED)
	handleIntentCompleted(): void {
		this.invalidate('intent completed');
	}

	private invalidate(reason: string): void {
		this.logger.debug(`Invalidating buddy context cache: ${reason}`);
		this.contextService.invalidateCache();
	}
}
