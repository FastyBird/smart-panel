import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

@Injectable()
export class HaSupervisorService {
	private readonly logger = createExtensionLogger(DEVICES_HOME_ASSISTANT_PLUGIN_NAME, 'HaSupervisor');

	private readonly supervisorToken: string | null;
	private readonly supervisorApiUrl: string;

	constructor() {
		this.supervisorToken = process.env.SUPERVISOR_TOKEN || null;
		this.supervisorApiUrl = process.env.SUPERVISOR_API_URL || 'http://supervisor/core';

		if (this.supervisorToken) {
			this.logger.log('Home Assistant Supervisor detected — using supervisor credentials');
		}
	}

	isInSupervisorMode(): boolean {
		return this.supervisorToken !== null;
	}

	getSupervisorToken(): string | null {
		return this.supervisorToken;
	}

	getSupervisorApiUrl(): string {
		return this.supervisorApiUrl.replace(/\/+$/, '');
	}

	getSupervisorWsUrl(): string {
		const url = this.getSupervisorApiUrl();

		if (url.startsWith('https://')) {
			return url.replace(/^https:\/\//, 'wss://');
		}

		return url.replace(/^http:\/\//, 'ws://');
	}
}
