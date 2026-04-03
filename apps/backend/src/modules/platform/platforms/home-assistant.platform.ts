import { SystemInfoDto } from '../dto/system-info.dto';
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

	async getSystemInfo(): Promise<SystemInfoDto> {
		return this.getContainerSystemInfo();
	}

	/**
	 * Attempt to read throttle status from sysfs (available when the
	 * addon container has the Raspberry Pi firmware sysfs path mounted).
	 * Falls back to all-clear defaults when the path is not available,
	 * since the Supervisor API does not expose throttle information.
	 */
	async getThrottleStatus(): Promise<ThrottleStatusDto> {
		const result = await this.readThrottleFromSysfs();

		if (result) {
			return result;
		}

		return this.validateDto(ThrottleStatusDto, this.parseThrottleFlags(0));
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

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return await response.text();
		} catch (error) {
			const err = error as Error;

			if (err.name === 'AbortError') {
				this.logger.error(`Supervisor API call timed out: ${method} ${endpoint}`);

				throw new PlatformException(`Home Assistant Supervisor API call timed out: ${method} ${endpoint}`);
			}

			this.logger.error(`Supervisor API call failed: ${method} ${endpoint} - ${err.message}`);

			throw new PlatformException(`Home Assistant Supervisor API call failed: ${err.message}`);
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
