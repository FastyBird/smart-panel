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

		try {
			const response = await fetch(url, {
				method,
				headers: {
					Authorization: `Bearer ${this.supervisorToken}`,
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return await response.text();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Supervisor API call failed: ${method} ${endpoint} - ${err.message}`);

			throw new PlatformException(`Home Assistant Supervisor API call failed: ${err.message}`);
		}
	}
}
