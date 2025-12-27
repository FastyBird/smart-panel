import { Inject, Injectable, OnModuleInit, forwardRef } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as ConfigEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { LightingIntentDto } from '../../spaces/dto/lighting-intent.dto';
import { SpaceIntentService } from '../../spaces/services/space-intent.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { LightingIntentType, LightingMode } from '../../spaces/spaces.constants';
import { SystemConfigModel } from '../models/config.model';
import { EventType, HouseMode, SYSTEM_MODULE_NAME } from '../system.constants';

/**
 * House Mode Actions Service
 *
 * Implements v2 spec deterministic actions for house modes:
 * - Away: Turn off all lights across all spaces
 * - Night: Apply night lighting per space (or turn off if no night role)
 * - Home: Non-destructive, just changes mode (no global restore)
 *
 * Listens to config changes and emits HOUSE_MODE_CHANGED events when
 * the house mode actually changes, then executes the appropriate actions.
 */
@Injectable()
export class HouseModeActionsService implements OnModuleInit {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'HouseModeActionsService');
	private previousMode: HouseMode | null = null;

	constructor(
		private readonly configService: ConfigService,
		@Inject(forwardRef(() => SpacesService))
		private readonly spacesService: SpacesService,
		@Inject(forwardRef(() => SpaceIntentService))
		private readonly spaceIntentService: SpaceIntentService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit(): void {
		// Initialize previous mode from current config
		try {
			const config = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
			this.previousMode = config.houseMode;
			this.logger.log(`Initialized house mode tracking, current mode=${this.previousMode}`);
		} catch {
			this.logger.warn('Could not read initial house mode, will detect on first change');
			this.previousMode = null;
		}
	}

	/**
	 * Listen for config updates and detect house mode changes.
	 * When house mode changes, emit the specific event and execute actions.
	 *
	 * Note: previousMode is updated immediately after detecting a change
	 * (before awaiting actions) to prevent race conditions when multiple
	 * CONFIG_UPDATED events fire rapidly.
	 */
	@OnEvent(ConfigEventType.CONFIG_UPDATED)
	async onConfigUpdated(): Promise<void> {
		try {
			const config = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
			const newMode = config.houseMode;

			if (this.previousMode !== null && newMode !== this.previousMode) {
				const oldMode = this.previousMode;
				// Update immediately to prevent race conditions with concurrent events
				this.previousMode = newMode;

				this.logger.log(`House mode changed from=${oldMode} to=${newMode}`);

				// Emit the specific house mode changed event
				this.eventEmitter.emit(EventType.HOUSE_MODE_CHANGED, {
					previousMode: oldMode,
					newMode: newMode,
				});

				// Execute deterministic actions for the new mode
				await this.executeHouseModeActions(newMode);
			} else {
				this.previousMode = newMode;
			}
		} catch (error) {
			// Config may not have system module yet, or other issue - log and continue
			this.logger.debug(`Could not process config update for house mode: ${error}`);
		}
	}

	/**
	 * Execute deterministic actions based on the new house mode.
	 *
	 * v2 spec semantics:
	 * - Away: Turn off all lights in all spaces
	 * - Night: Apply night lighting per space (role-based or fallback to off)
	 * - Home: Non-destructive, no global restore (just mode change)
	 */
	private async executeHouseModeActions(mode: HouseMode): Promise<void> {
		this.logger.log(`Executing house mode actions for mode=${mode}`);

		try {
			const spaces = await this.spacesService.findAll();

			if (spaces.length === 0) {
				this.logger.debug('No spaces found, skipping house mode actions');
				return;
			}

			switch (mode) {
				case HouseMode.AWAY:
					await this.executeAwayModeActions(spaces.map((s) => s.id));
					break;

				case HouseMode.NIGHT:
					await this.executeNightModeActions(spaces.map((s) => s.id));
					break;

				case HouseMode.HOME:
					// Home mode is non-destructive per v2 spec
					// No global state restore in MVP
					this.logger.log('Home mode activated - no actions taken (non-destructive)');
					break;

				default: {
					const exhaustiveCheck: never = mode;
					this.logger.warn(`Unknown house mode: ${String(exhaustiveCheck)}`);
				}
			}
		} catch (error) {
			this.logger.error(`Error executing house mode actions: ${error}`);
		}
	}

	/**
	 * Execute Away mode actions: Turn off all lights in all spaces
	 */
	private async executeAwayModeActions(spaceIds: string[]): Promise<void> {
		this.logger.log(`Executing Away mode: turning off lights in ${spaceIds.length} spaces`);

		const intent: LightingIntentDto = {
			type: LightingIntentType.OFF,
		};

		let successCount = 0;
		let failCount = 0;

		for (const spaceId of spaceIds) {
			try {
				const result = await this.spaceIntentService.executeLightingIntent(spaceId, intent);
				if (result.success) {
					successCount++;
					this.logger.debug(`Away mode: turned off lights in space=${spaceId} affected=${result.affectedDevices}`);
				} else {
					failCount++;
					this.logger.warn(`Away mode: failed to turn off lights in space=${spaceId}`);
				}
			} catch (error) {
				failCount++;
				this.logger.error(`Away mode: error turning off lights in space=${spaceId}: ${error}`);
			}
		}

		this.logger.log(`Away mode complete: success=${successCount} failed=${failCount}`);
	}

	/**
	 * Execute Night mode actions: Apply night lighting per space
	 *
	 * Uses the existing SpaceIntentService SET_MODE with LightingMode.NIGHT
	 * which handles role-based orchestration:
	 * - If night role lights exist: turn on night lights, turn off others
	 * - If no night role lights: fallback to main lights at low brightness (or off)
	 */
	private async executeNightModeActions(spaceIds: string[]): Promise<void> {
		this.logger.log(`Executing Night mode: applying night lighting in ${spaceIds.length} spaces`);

		const intent: LightingIntentDto = {
			type: LightingIntentType.SET_MODE,
			mode: LightingMode.NIGHT,
		};

		let successCount = 0;
		let failCount = 0;

		for (const spaceId of spaceIds) {
			try {
				const result = await this.spaceIntentService.executeLightingIntent(spaceId, intent);
				if (result.success) {
					successCount++;
					this.logger.debug(`Night mode: applied lighting in space=${spaceId} affected=${result.affectedDevices}`);
				} else {
					failCount++;
					this.logger.warn(`Night mode: failed to apply lighting in space=${spaceId}`);
				}
			} catch (error) {
				failCount++;
				this.logger.error(`Night mode: error applying lighting in space=${spaceId}: ${error}`);
			}
		}

		this.logger.log(`Night mode complete: success=${successCount} failed=${failCount}`);
	}
}
