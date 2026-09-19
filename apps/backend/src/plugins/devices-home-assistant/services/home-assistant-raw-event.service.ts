import { Injectable, Optional } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { normalizeHaEventType } from '../utils/ha-event.utils';

import { WsEventService } from './home-assistant.ws.service';

export interface ParsedRawEvent {
	deviceIdentifier: string;
	eventType: string;
	nativeCommand: string;
	endpointId?: number;
	sourceOccurrenceId?: string;
}

/**
 * Service for decoding documented legacy Home Assistant raw event-bus events (e.g. zha_event, deconz_event)
 * and providing actionable diagnostics for unsupported raw event sources.
 */
@Injectable()
export class HomeAssistantRawEventService implements WsEventService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HomeAssistantRawEventService',
	);

	private occurrenceSequence = 0;

	private generateSourceOccurrenceId(
		deviceIdentifier: string,
		command: string | number,
		contextId?: string | null,
	): string {
		if (contextId && typeof contextId === 'string' && contextId.trim()) {
			return `${deviceIdentifier}:${command}:${contextId.trim()}`;
		}
		this.occurrenceSequence = (this.occurrenceSequence + 1) % Number.MAX_SAFE_INTEGER;
		return `${deviceIdentifier}:${command}:${Date.now()}_${this.occurrenceSequence}`;
	}

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		@Optional()
		private readonly channelInputOccurrencesService?: ChannelInputOccurrencesService,
	) {}

	get event(): string {
		return '*';
	}

	/**
	 * Parses a zha_event payload into a normalized button event.
	 */
	parseZhaEvent(data: Record<string, unknown>, contextId?: string | null): ParsedRawEvent | null {
		const deviceIdentifier =
			(typeof data.device_id === 'string' && data.device_id.trim() ? data.device_id.trim() : null) ??
			(typeof data.device_ieee === 'string' && data.device_ieee.trim() ? data.device_ieee.trim() : null) ??
			(typeof data.unique_id === 'string' && data.unique_id.trim() ? data.unique_id.trim() : null);
		const command = typeof data.command === 'string' ? data.command : null;

		if (!deviceIdentifier || !command) {
			return null;
		}

		let eventType: string;
		const lowerCommand = command.toLowerCase();
		switch (lowerCommand) {
			case 'on':
			case 'off':
			case 'toggle':
			case 'button_single':
			case 'single':
			case 'press':
				eventType = 'press';
				break;
			case 'button_double':
			case 'double':
				eventType = 'double_press';
				break;
			case 'button_triple':
			case 'triple':
				eventType = 'triple_press';
				break;
			case 'button_hold':
			case 'hold':
			case 'move':
			case 'move_with_on_off':
				eventType = 'long_press';
				break;
			case 'release':
			case 'stop':
			case 'stop_with_on_off':
				eventType = 'release';
				break;
			default:
				eventType = normalizeHaEventType(command);
				break;
		}

		const endpointId = typeof data.endpoint_id === 'number' ? data.endpoint_id : undefined;

		const upstreamContextId =
			(typeof contextId === 'string' && contextId.trim() ? contextId.trim() : null) ??
			(typeof data.context === 'object' &&
			data.context !== null &&
			typeof (data.context as Record<string, unknown>).id === 'string'
				? ((data.context as Record<string, unknown>).id as string).trim()
				: null) ??
			(typeof data.context_id === 'string' && data.context_id.trim() ? data.context_id.trim() : null);

		const sourceOccurrenceId = this.generateSourceOccurrenceId(deviceIdentifier, command, upstreamContextId);

		return {
			deviceIdentifier,
			eventType,
			nativeCommand: command,
			endpointId,
			sourceOccurrenceId,
		};
	}

	/**
	 * Parses a deconz_event payload into a normalized button event.
	 */
	parseDeconzEvent(data: Record<string, unknown>, contextId?: string | null): ParsedRawEvent | null {
		const identifier =
			typeof data.unique_id === 'string'
				? data.unique_id
				: typeof data.id === 'string'
					? data.id
					: (data.device_id as string);

		const eventCode = typeof data.event === 'number' && Number.isInteger(data.event) ? data.event : null;

		if (!identifier || eventCode === null) {
			return null;
		}

		// deCONZ event format: B00N where B is button number (1-4) and N is interaction:
		// 0: press / initial down, 1: hold / long press, 2: short release / press, 3: long release, 4: double press, 5: triple press
		const actionCode = eventCode % 100;
		const buttonNum = Math.floor(eventCode / 1000);

		let eventType: string;
		switch (actionCode) {
			case 0:
				eventType = 'down';
				break;
			case 1:
				eventType = 'long_press';
				break;
			case 2:
				eventType = 'press';
				break;
			case 3:
				eventType = 'release';
				break;
			case 4:
				eventType = 'double_press';
				break;
			case 5:
				eventType = 'triple_press';
				break;
			default:
				return null;
		}

		const upstreamContextId =
			(typeof contextId === 'string' && contextId.trim() ? contextId.trim() : null) ??
			(typeof data.context === 'object' &&
			data.context !== null &&
			typeof (data.context as Record<string, unknown>).id === 'string'
				? ((data.context as Record<string, unknown>).id as string).trim()
				: null) ??
			(typeof data.context_id === 'string' && data.context_id.trim() ? data.context_id.trim() : null);

		const sourceOccurrenceId = this.generateSourceOccurrenceId(identifier, eventCode, upstreamContextId);

		return {
			deviceIdentifier: identifier,
			eventType,
			nativeCommand: String(eventCode),
			endpointId: buttonNum > 0 ? buttonNum : undefined,
			sourceOccurrenceId,
		};
	}

	/**
	 * Generates actionable diagnostics for unsupported raw event sources.
	 */
	diagnoseUnsupportedEvent(eventType: string, data?: Record<string, unknown>): string {
		if (eventType === 'zha_event' || eventType === 'deconz_event') {
			return (
				`[RAW EVENT] Incomplete payload for documented raw event "${eventType}". ` +
				`Missing mandatory identifiers (e.g. device_ieee, unique_id, command, or event code). Data: ${JSON.stringify(data ?? {})}`
			);
		}

		return (
			`[RAW EVENT] Unsupported raw event source "${eventType}". ` +
			`Arbitrary event-bus names cannot be assumed to encode physical hardware buttons without verified schema. ` +
			`To integrate buttons reliably, use standard Home Assistant 'event.*' entities.`
		);
	}

	/**
	 * Handles an incoming raw event from the Home Assistant WebSocket event bus.
	 */
	async handle(rawMsg: Record<string, unknown>): Promise<void> {
		const eventType = typeof rawMsg.event_type === 'string' ? rawMsg.event_type : null;
		const data =
			typeof rawMsg.data === 'object' && rawMsg.data !== null ? (rawMsg.data as Record<string, unknown>) : {};

		if (!eventType) {
			return;
		}

		const contextId =
			typeof rawMsg.context === 'object' &&
			rawMsg.context !== null &&
			typeof (rawMsg.context as Record<string, unknown>).id === 'string'
				? ((rawMsg.context as Record<string, unknown>).id as string)
				: null;

		let parsed: ParsedRawEvent | null = null;
		if (eventType === 'zha_event') {
			parsed = this.parseZhaEvent(data, contextId);
		} else if (eventType === 'deconz_event') {
			parsed = this.parseDeconzEvent(data, contextId);
		}

		if (!parsed) {
			const diagnostic = this.diagnoseUnsupportedEvent(eventType, data);
			this.logger.debug(diagnostic);
			return;
		}

		// Find matching adopted device
		const devices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);
		let device = devices.find((d) => d.haDeviceId === parsed?.deviceIdentifier || d.id === parsed?.deviceIdentifier);

		let targetChannel: HomeAssistantChannelEntity | undefined;
		let targetProperty: HomeAssistantChannelPropertyEntity | undefined;

		if (!device) {
			for (const dev of devices) {
				const channels = await this.channelsService.findAll<HomeAssistantChannelEntity>(dev.id);
				for (const chan of channels) {
					const properties = await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(chan.id);
					const matchedProp = properties.find((p) => p.haEntityId === parsed?.deviceIdentifier);
					if (matchedProp) {
						device = dev;
						targetChannel = chan;
						targetProperty = matchedProp.category === PropertyCategory.EVENT ? matchedProp : undefined;
						break;
					}
				}
				if (device) break;
			}
		}

		if (!device) {
			this.logger.debug(
				`[RAW EVENT] No adopted device found matching raw event identifier: "${parsed.deviceIdentifier}". ` +
					`Ensure the device is adopted in Smart Panel.`,
			);
			return;
		}

		if (!targetChannel) {
			const channels = await this.channelsService.findAll<HomeAssistantChannelEntity>(device.id);
			const buttonChannels = channels.filter((c) => c.category === ChannelCategory.BUTTON);

			if (buttonChannels.length === 0) {
				this.logger.debug(`[RAW EVENT] Device ${device.id} has no BUTTON channels mapped.`);
				return;
			}

			if (parsed.endpointId !== undefined) {
				const endpoint = parsed.endpointId;
				targetChannel = buttonChannels.find(
					(c) =>
						c.identifier === String(endpoint) ||
						c.identifier === `button_${endpoint}` ||
						c.identifier === `btn_${endpoint}` ||
						c.identifier === `endpoint_${endpoint}` ||
						c.identifier?.endsWith(`_${endpoint}`),
				);

				if (!targetChannel) {
					this.logger.debug(
						`[RAW EVENT] No button channel found matching endpoint ${endpoint} for device ${device.id}.`,
					);
					return;
				}
			} else {
				targetChannel = buttonChannels[0];
			}
		}

		if (!targetProperty) {
			const properties = await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
				targetChannel.id,
			);
			targetProperty = properties.find((p) => p.category === PropertyCategory.EVENT);
		}

		if (!targetProperty) {
			this.logger.debug(`[RAW EVENT] Channel ${targetChannel.id} has no EVENT property.`);
			return;
		}

		if (this.channelInputOccurrencesService) {
			await this.channelInputOccurrencesService.publishOccurrence({
				deviceId: device.id,
				channelId: targetChannel.id,
				propertyId: targetProperty.id,
				event: parsed.eventType,
				nativeEventType: parsed.nativeCommand,
				sourceOccurrenceId: parsed.sourceOccurrenceId,
				data: {
					event_type: eventType,
					raw_data: data,
				},
			});
		}
	}
}
