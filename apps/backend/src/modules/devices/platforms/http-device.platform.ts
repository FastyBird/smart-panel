import fetch, { RequestInit, Response } from 'node-fetch';

import { Logger } from '@nestjs/common';

import { IDevicePlatform, IDevicePropertyData } from './device.platform';

export abstract class HttpDevicePlatform implements IDevicePlatform {
	private readonly innerLogger = new Logger(HttpDevicePlatform.name);

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
		this.innerLogger.log(`[HTTP PLATFORM] Sending command to ${endpoint}`);

		try {
			for (let i = 0; i < attempts; i++) {
				const response = await this.attemptToSendCommand(endpoint, {
					method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
					timeout: 5000, // 5 seconds timeout
					...options,
				});

				if (response === false) {
					this.innerLogger.warn(`[HTTP PLATFORM] Retry attempt ${i + 1} failed`);
				} else {
					if (!response.ok) {
						return false;
					}

					return response;
				}
			}
		} catch (error) {
			const err = error as Error;

			this.innerLogger.error('[HTTP PLATFORM] Error processing command', { message: err.message, stack: err.stack });

			return false;
		}

		this.innerLogger.error(`[HTTP PLATFORM] Sending command failed after ${attempts} attempts`);

		return false;
	}

	private async attemptToSendCommand(endpoint: string, request: RequestInit): Promise<Response | false> {
		const response = await fetch(endpoint, request);

		if (!response.ok) {
			const responseBody = await response.text();

			this.innerLogger.warn(
				`[HTTP PLATFORM] Failed request to ${endpoint} status=${response.status} response=${responseBody}`,
			);

			// Only retry on 500+ server errors
			if (response.status < 500) {
				return response;
			}

			return false;
		} else {
			this.innerLogger.log(`[HTTP PLATFORM] Successfully processed command to ${endpoint}`);

			return response;
		}
	}
}
