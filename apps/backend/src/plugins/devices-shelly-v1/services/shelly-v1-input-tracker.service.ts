import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DEVICES_SHELLY_V1_PLUGIN_NAME } from '../devices-shelly-v1.constants';

export interface InputTrackResult {
	shouldPublish: boolean;
	isReset: boolean;
}

interface ChannelCounterState {
	lastCounter: number;
	isInitialized: boolean;
}

/**
 * Service to track event counters and handle freshness, deduplication,
 * counter resets, and baselining for Shelly Gen 1 devices.
 */
@Injectable()
export class ShellyV1InputTrackerService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1InputTrackerService',
	);

	/**
	 * Map of deviceId:channelIndex -> counter state
	 */
	private readonly states = new Map<string, ChannelCounterState>();

	private getKey(deviceId: string, channelIndex: number): string {
		return `${deviceId}:${channelIndex}`;
	}

	/**
	 * Baseline stale status on startup, discovery, or initial read.
	 * Marks the counter as initialized so the existing counter is not emitted as an event.
	 */
	baseline(deviceId: string, channelIndex: number, counter: number): void {
		const key = this.getKey(deviceId, channelIndex);
		this.states.set(key, {
			lastCounter: counter,
			isInitialized: true,
		});
		this.logger.debug(`Baselined input counter for ${key} at ${counter}`);
	}

	/**
	 * Track an incoming input event counter change and determine if an occurrence should be published.
	 */
	trackEvent(deviceId: string, channelIndex: number, counter: number, rawEvent: string): InputTrackResult {
		const key = this.getKey(deviceId, channelIndex);
		const state = this.states.get(key);

		// If this channel has never been seen or baselined, baseline it now.
		// Stale status received on initial connection/startup must not trigger an event.
		if (!state || !state.isInitialized) {
			this.states.set(key, {
				lastCounter: counter,
				isInitialized: true,
			});
			this.logger.debug(`Initial state baseline for ${key} at counter=${counter}, suppressing event`);
			return { shouldPublish: false, isReset: false };
		}

		// Counter unchanged: repeated status read, periodic CoAP multicast, or reconnect without new events
		if (counter === state.lastCounter) {
			return { shouldPublish: false, isReset: false };
		}

		// Counter reset or rollover: device rebooted, battery replaced, or 32-bit counter overflow
		if (counter < state.lastCounter) {
			this.logger.debug(`Counter reset detected on ${key}: previous=${state.lastCounter}, new=${counter}`);
			state.lastCounter = counter;

			// If reset happened and there is a valid event with counter > 0 (e.g. initial press after reboot)
			if (counter > 0 && rawEvent.length > 0) {
				return { shouldPublish: true, isReset: true };
			}

			return { shouldPublish: false, isReset: true };
		}

		// Normal increment (counter > state.lastCounter): genuine new event
		state.lastCounter = counter;

		if (rawEvent.length > 0) {
			return { shouldPublish: true, isReset: false };
		}

		return { shouldPublish: false, isReset: false };
	}

	/**
	 * Get the last recorded counter for a channel
	 */
	getLastCounter(deviceId: string, channelIndex: number): number | undefined {
		return this.states.get(this.getKey(deviceId, channelIndex))?.lastCounter;
	}

	/**
	 * Reset/clear state for a device
	 */
	resetDevice(deviceId: string): void {
		for (const key of Array.from(this.states.keys())) {
			if (key.startsWith(`${deviceId}:`)) {
				this.states.delete(key);
			}
		}
	}

	/**
	 * Clear all tracked states
	 */
	clear(): void {
		this.states.clear();
	}
}
