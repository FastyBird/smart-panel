import fs from 'fs/promises';

import { ThrottleStatusDto } from '../dto/throttle-status.dto';
import { PlatformException } from '../platform.exceptions';

import { GenericPlatform } from './generic.platform';

export class HomeAssistantPlatform extends GenericPlatform {
	private readonly supervisorToken: string | null;
	private readonly supervisorUrl: string;

	constructor() {
		super();

		this.supervisorToken = process.env.SUPERVISOR_TOKEN ?? null;
		this.supervisorUrl = process.env.SUPERVISOR_URL ?? 'http://supervisor';
	}

	/**
	 * Attempt to read throttle status from sysfs (available when the
	 * addon container has the Raspberry Pi firmware sysfs path mounted).
	 * Falls back to all-clear defaults when the path is not available,
	 * since the Supervisor API does not expose throttle information.
	 */
	async getThrottleStatus(): Promise<ThrottleStatusDto> {
		try {
			const data = await fs.readFile('/sys/devices/platform/soc/soc:firmware/get_throttled', 'utf-8');
			const status = parseInt(data.trim(), 16);

			if (!isNaN(status)) {
				return this.validateDto(ThrottleStatusDto, {
					undervoltage: !!(status & 0x1),
					frequencyCapping: !!(status & 0x2),
					throttling: !!(status & 0x4),
					softTempLimit: !!(status & 0x8),
				});
			}
		} catch {
			// sysfs not available inside this container
		}

		return this.validateDto(ThrottleStatusDto, {
			undervoltage: false,
			frequencyCapping: false,
			throttling: false,
			softTempLimit: false,
		});
	}

	async rebootDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Restarting add-on via HA Supervisor API...');

		await this.callSupervisorApi('/addons/self/restart', 'POST');
	}

	async powerOffDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Stopping add-on via HA Supervisor API...');

		await this.callSupervisorApi('/addons/self/stop', 'POST');
	}

	private async callSupervisorApi(endpoint: string, method: string): Promise<string> {
		if (!this.supervisorToken) {
			throw new PlatformException(
				'SUPERVISOR_TOKEN is not set. This platform requires the Home Assistant Supervisor environment.',
			);
		}

		const url = `${this.supervisorUrl}${endpoint}`;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30_000);

		try {
			const response = await fetch(url, {
				method,
				headers: {
					Authorization: `Bearer ${this.supervisorToken}`,
					'Content-Type': 'application/json',
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return await response.text();
		} catch (error) {
			clearTimeout(timeoutId);

			const err = error as Error;

			if (err.name === 'AbortError') {
				this.logger.error(`Supervisor API call timed out: ${method} ${endpoint}`);

				throw new PlatformException(`Home Assistant Supervisor API call timed out: ${method} ${endpoint}`);
			}

			this.logger.error(`Supervisor API call failed: ${method} ${endpoint} - ${err.message}`);

			throw new PlatformException(`Home Assistant Supervisor API call failed: ${err.message}`);
		}
	}
}
