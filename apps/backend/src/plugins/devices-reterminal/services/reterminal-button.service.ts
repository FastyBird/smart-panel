import * as fs from 'fs';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import {
	DEFAULT_BUTTON_DOUBLE_PRESS_MS,
	DEFAULT_BUTTON_LONG_PRESS_MS,
	DEVICES_RETERMINAL_PLUGIN_NAME,
	DEVICES_RETERMINAL_TYPE,
	RETERMINAL_CHANNEL_IDENTIFIERS,
} from '../devices-reterminal.constants';
import { UpdateReTerminalChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ReTerminalChannelEntity, ReTerminalChannelPropertyEntity } from '../entities/devices-reterminal.entity';

// Linux input event structures (from <linux/input.h>)
// struct input_event { struct timeval time; __u16 type; __u16 code; __s32 value; }
// On 64-bit: timeval = 16 bytes → event = 24 bytes, fields at offsets 16/18/20
// On 32-bit: timeval =  8 bytes → event = 16 bytes, fields at offsets  8/10/12
const IS_64BIT = ['arm64', 'x64', 'ppc64', 's390x'].includes(process.arch);
const INPUT_EVENT_SIZE = IS_64BIT ? 24 : 16;
const INPUT_EVENT_TYPE_OFFSET = IS_64BIT ? 16 : 8;
const EV_KEY = 1;

// reTerminal button key codes (default mapping)
const KEY_MAP: Record<number, string> = {
	// F1=KEY_A(30), F2=KEY_B(48), F3=KEY_C(46), O=KEY_D(32) - default reTerminal codes
	30: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F1,
	48: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F2,
	46: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_F3,
	32: RETERMINAL_CHANNEL_IDENTIFIERS.BUTTON_O,
};

interface ButtonState {
	pressedAt: number | null;
	lastReleaseAt: number | null;
	longPressTimer: ReturnType<typeof setTimeout> | null;
	longPressFired: boolean;
	doublePressTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Listens for reTerminal hardware button events via evdev input device.
 * Detects press, long_press, and double_press events.
 */
@Injectable()
export class ReTerminalButtonService {
	private readonly logger = createExtensionLogger(DEVICES_RETERMINAL_PLUGIN_NAME, ReTerminalButtonService.name);
	private inputStream: fs.ReadStream | null = null;
	private deviceId: string | null = null;
	private readonly buttonStates: Map<string, ButtonState> = new Map();

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	/**
	 * Start listening for button events on the given input device.
	 */
	start(deviceId: string, inputDevicePath: string): void {
		// Clean up any previous stream and timers to prevent fd leaks and duplicate events
		this.stop();

		this.deviceId = deviceId;

		try {
			this.inputStream = fs.createReadStream(inputDevicePath, {
				flags: 'r',
				highWaterMark: INPUT_EVENT_SIZE,
			});

			this.inputStream.on('data', (data: Buffer) => {
				this.handleInputEvent(data);
			});

			this.inputStream.on('error', (error) => {
				this.logger.warn(`Button input stream error: ${error.message}`);
			});

			this.logger.log(`Listening for button events on ${inputDevicePath}`);
		} catch (error) {
			this.logger.warn(`Could not open input device ${inputDevicePath}: ${error}`);
		}
	}

	/**
	 * Stop listening for button events.
	 */
	stop(): void {
		if (this.inputStream) {
			this.inputStream.destroy();
			this.inputStream = null;
		}

		// Clear all timers
		for (const state of this.buttonStates.values()) {
			if (state.longPressTimer) clearTimeout(state.longPressTimer);
			if (state.doublePressTimer) clearTimeout(state.doublePressTimer);
		}

		this.buttonStates.clear();
		this.deviceId = null;
	}

	/**
	 * Find the reTerminal button input device path.
	 */
	async findInputDevice(): Promise<string | null> {
		try {
			const inputDir = '/sys/class/input';
			const entries = await fs.promises.readdir(inputDir);

			for (const entry of entries) {
				if (!entry.startsWith('event')) continue;

				try {
					const deviceName = await fs.promises.readFile(`${inputDir}/${entry}/device/name`, 'utf-8');
					const name = deviceName.trim();

					// reTerminal buttons are exposed via gpio_keys kernel driver
					if (name === 'gpio_keys') {
						return `/dev/input/${entry}`;
					}
				} catch {
					continue;
				}
			}
		} catch {
			this.logger.debug('Could not scan input devices');
		}

		return null;
	}

	private handleInputEvent(data: Buffer): void {
		// Process all input events in the buffer (a single chunk may contain multiple events)
		for (let offset = 0; offset + INPUT_EVENT_SIZE <= data.length; offset += INPUT_EVENT_SIZE) {
			// Parse input_event struct (field offsets depend on architecture)
			const type = data.readUInt16LE(offset + INPUT_EVENT_TYPE_OFFSET);
			const code = data.readUInt16LE(offset + INPUT_EVENT_TYPE_OFFSET + 2);
			const value = data.readInt32LE(offset + INPUT_EVENT_TYPE_OFFSET + 4);

			// Only handle key events
			if (type !== EV_KEY) continue;

			const channelIdentifier = KEY_MAP[code];

			if (!channelIdentifier) continue;

			if (value === 1) {
				// Key pressed
				this.handleButtonPress(channelIdentifier);
			} else if (value === 0) {
				// Key released
				this.handleButtonRelease(channelIdentifier);
			}
		}
	}

	private handleButtonPress(channelIdentifier: string): void {
		const state = this.getButtonState(channelIdentifier);
		state.pressedAt = Date.now();
		state.longPressFired = false;

		// Set detected = true
		void this.emitPropertyValue(channelIdentifier, 'detected', true);

		// Clear any existing long press timer before starting a new one
		if (state.longPressTimer) {
			clearTimeout(state.longPressTimer);
		}

		// Cancel pending single-press timer from a previous release so it doesn't
		// fire a spurious 'press' event during a double-press gesture
		if (state.doublePressTimer) {
			clearTimeout(state.doublePressTimer);
			state.doublePressTimer = null;
		}

		// Start long press detection timer
		state.longPressTimer = setTimeout(() => {
			void this.emitPropertyValue(channelIdentifier, 'event', 'long_press');
			state.longPressTimer = null;
			state.longPressFired = true;
		}, DEFAULT_BUTTON_LONG_PRESS_MS);
	}

	private handleButtonRelease(channelIdentifier: string): void {
		const state = this.getButtonState(channelIdentifier);
		const now = Date.now();
		const pressDuration = state.pressedAt ? now - state.pressedAt : 0;

		// Set detected = false
		void this.emitPropertyValue(channelIdentifier, 'detected', false);

		// Cancel long press timer if still pending
		const timerWasPending = state.longPressTimer !== null;

		if (state.longPressTimer) {
			clearTimeout(state.longPressTimer);
			state.longPressTimer = null;
		}

		// If it was a long press (timer already fired, or duration met but timer
		// hadn't fired yet due to event loop scheduling), emit long_press and return
		if (pressDuration >= DEFAULT_BUTTON_LONG_PRESS_MS) {
			if (timerWasPending && !state.longPressFired) {
				void this.emitPropertyValue(channelIdentifier, 'event', 'long_press');
			}

			state.pressedAt = null;

			return;
		}

		// Check for double press
		if (state.lastReleaseAt && now - state.lastReleaseAt < DEFAULT_BUTTON_DOUBLE_PRESS_MS) {
			// Double press detected - cancel pending single press
			if (state.doublePressTimer) {
				clearTimeout(state.doublePressTimer);
				state.doublePressTimer = null;
			}

			void this.emitPropertyValue(channelIdentifier, 'event', 'double_press');
			state.lastReleaseAt = null;
		} else {
			// Potential single press - wait for double press window
			state.lastReleaseAt = now;
			state.doublePressTimer = setTimeout(() => {
				void this.emitPropertyValue(channelIdentifier, 'event', 'press');
				state.doublePressTimer = null;
			}, DEFAULT_BUTTON_DOUBLE_PRESS_MS);
		}

		state.pressedAt = null;
	}

	private getButtonState(channelIdentifier: string): ButtonState {
		let state = this.buttonStates.get(channelIdentifier);

		if (!state) {
			state = {
				pressedAt: null,
				lastReleaseAt: null,
				longPressTimer: null,
				longPressFired: false,
				doublePressTimer: null,
			};

			this.buttonStates.set(channelIdentifier, state);
		}

		return state;
	}

	private async emitPropertyValue(
		channelIdentifier: string,
		propertyIdentifier: string,
		value: string | boolean,
	): Promise<void> {
		if (!this.deviceId) return;

		try {
			const channel = await this.channelsService.findOneBy<ReTerminalChannelEntity>(
				'identifier',
				channelIdentifier,
				this.deviceId,
				DEVICES_RETERMINAL_TYPE,
			);

			if (!channel) return;

			const property = await this.channelsPropertiesService.findOneBy<ReTerminalChannelPropertyEntity>(
				'identifier',
				propertyIdentifier,
				channel.id,
				DEVICES_RETERMINAL_TYPE,
			);

			if (!property) return;

			await this.channelsPropertiesService.update<ReTerminalChannelPropertyEntity, UpdateReTerminalChannelPropertyDto>(
				property.id,
				toInstance(UpdateReTerminalChannelPropertyDto, {
					type: DEVICES_RETERMINAL_TYPE,
					value,
				}),
			);
		} catch (error) {
			this.logger.debug(`Failed to emit button event ${channelIdentifier}.${propertyIdentifier}: ${error}`);
		}
	}
}
