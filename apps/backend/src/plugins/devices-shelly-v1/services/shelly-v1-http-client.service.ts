import { Injectable, Logger } from '@nestjs/common';

import { SHELLY_HTTP_ENDPOINTS, ShellyHttpEndpoint, ShellyHttpEndpointResponseMap } from '../devices-shelly-v1.constants';
import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import {
	ShellyInfoResponse,
	ShellyLoginResponse,
	ShellySettingsResponse,
	ShellyStatusResponse,
} from '../interfaces/shelly-http.interface';

/**
 * HTTP client for Shelly Gen 1 REST API
 * Similar to ShellyRpcClientService but for Gen 1 REST endpoints
 */
@Injectable()
export class ShellyV1HttpClientService {
	private readonly logger = new Logger(ShellyV1HttpClientService.name);

	private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds

	/**
	 * Get device information from /shelly endpoint
	 */
	async getDeviceInfo(host: string, timeout?: number): Promise<ShellyInfoResponse> {
		return this.get(host, SHELLY_HTTP_ENDPOINTS.DEVICE_INFO, timeout) as Promise<ShellyInfoResponse>;
	}

	/**
	 * Get device settings from /settings endpoint
	 */
	async getDeviceSettings(host: string, timeout?: number): Promise<ShellySettingsResponse> {
		return this.get(host, SHELLY_HTTP_ENDPOINTS.SETTINGS, timeout) as Promise<ShellySettingsResponse>;
	}

	/**
	 * Get device status from /status endpoint
	 */
	async getDeviceStatus(host: string, timeout?: number): Promise<ShellyStatusResponse> {
		return this.get(host, SHELLY_HTTP_ENDPOINTS.STATUS, timeout) as Promise<ShellyStatusResponse>;
	}

	/**
	 * Get login settings from /settings/login endpoint
	 */
	async getLoginSettings(host: string, timeout?: number): Promise<ShellyLoginResponse> {
		return this.get(host, SHELLY_HTTP_ENDPOINTS.LOGIN, timeout) as Promise<ShellyLoginResponse>;
	}

	/**
	 * Generic HTTP GET request to Shelly device with type-safe endpoint mapping
	 */
	private async get<E extends ShellyHttpEndpoint>(
		host: string,
		endpoint: E,
		timeout?: number,
	): Promise<ShellyHttpEndpointResponseMap[E]> {
		const url = `http://${host}${endpoint}`;
		const requestTimeout = timeout || this.DEFAULT_TIMEOUT;

		this.logger.debug(`[SHELLY V1][HTTP CLIENT] Fetching ${url}`);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new DevicesShellyV1Exception(
					`HTTP request failed: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as ShellyHttpEndpointResponseMap[E];

			this.logger.debug(`[SHELLY V1][HTTP CLIENT] Response from ${url}: ${JSON.stringify(data).substring(0, 200)}...`);

			return data;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new DevicesShellyV1Exception(
						`Request timeout after ${requestTimeout}ms for ${url}`,
					);
				}

				throw new DevicesShellyV1Exception(
					`HTTP request failed: ${error.message}`,
				);
			}

			throw new DevicesShellyV1Exception(
				`HTTP request failed: ${String(error)}`,
			);
		}
	}
}
