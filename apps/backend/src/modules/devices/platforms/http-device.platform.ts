import fetch, { RequestInit, Response } from 'node-fetch';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';

import { IDevicePlatform, IDevicePropertyData } from './device.platform';

export abstract class HttpDevicePlatform implements IDevicePlatform {
	private readonly innerLogger = createExtensionLogger(DEVICES_MODULE_NAME, 'HttpDevicePlatform');

	abstract getType(): string;

	abstract process({ device, channel, property, value }: IDevicePropertyData): Promise<boolean>;

	abstract processBatch(updates: Array<IDevicePropertyData>): Promise<boolean>;

	protected async sendCommand(
		endpoint: string,
		payload: Record<string, any>,
		method: 'POST' | 'PUT' | 'PATCH' = 'PUT',
		attempts = 3,
		options: RequestInit = {},
	): Promise<Response | false> {
		this.innerLogger.log(`Sending command to ${endpoint}`);

		try {
			for (let i = 0; i < attempts; i++) {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 5000); // 5-second timeout

				try {
					const response = await this.attemptToSendCommand(endpoint, {
						method,
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
						signal: controller.signal,
						...options,
					});

					clearTimeout(timeout);

					if (response === false) {
						this.innerLogger.warn(`Retry attempt ${i + 1} failed`);
					} else {
						if (!response.ok) {
							return false;
						}
						return response;
					}
				} catch (error) {
					clearTimeout(timeout);

					if (error instanceof Error && error.name === 'AbortError') {
						this.innerLogger.warn(`Request to ${endpoint} timed out`);
						continue; // Retry
					}

					throw error;
				}
			}
		} catch (error) {
			const err = error as Error;

			this.innerLogger.error('Error processing command', { message: err.message, stack: err.stack });

			return false;
		}

		this.innerLogger.error(`Sending command failed after ${attempts} attempts`);

		return false;
	}

	private async attemptToSendCommand(endpoint: string, request: RequestInit): Promise<Response | false> {
		const response = await fetch(endpoint, request);

		if (!response.ok) {
			const responseBody = await response.text();

			this.innerLogger.warn(`Failed request to ${endpoint} status=${response.status} response=${responseBody}`);

			// Only retry on 500+ server errors
			if (response.status < 500) {
				return response;
			}

			return false;
		} else {
			this.innerLogger.log(`Successfully processed command to ${endpoint}`);

			return response;
		}
	}
}
