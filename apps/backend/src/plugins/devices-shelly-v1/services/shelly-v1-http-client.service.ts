import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	SHELLY_HTTP_ENDPOINTS,
	ShellyHttpEndpoint,
	ShellyHttpEndpointResponseMap,
} from '../devices-shelly-v1.constants';
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
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1HttpClientService',
	);

	private readonly DEFAULT_TIMEOUT = 5000; // 5 seconds

	/**
	 * Get device information from /shelly endpoint
	 * Note: This endpoint does not require authentication
	 */
	async getDeviceInfo(host: string, timeout?: number): Promise<ShellyInfoResponse> {
		return this.get(host, SHELLY_HTTP_ENDPOINTS.DEVICE_INFO, timeout) as Promise<ShellyInfoResponse>;
	}

	/**
	 * Get device settings from /settings endpoint
	 * Note: This endpoint requires authentication when enabled
	 */
	async getDeviceSettings(
		host: string,
		timeout?: number,
		username?: string,
		password?: string,
	): Promise<ShellySettingsResponse> {
		return this.get(
			host,
			SHELLY_HTTP_ENDPOINTS.SETTINGS,
			timeout,
			username,
			password,
		) as Promise<ShellySettingsResponse>;
	}

	/**
	 * Get device status from /status endpoint
	 * Note: This endpoint requires authentication when enabled
	 */
	async getDeviceStatus(
		host: string,
		timeout?: number,
		username?: string,
		password?: string,
	): Promise<ShellyStatusResponse> {
		return this.get(host, SHELLY_HTTP_ENDPOINTS.STATUS, timeout, username, password) as Promise<ShellyStatusResponse>;
	}

	/**
	 * Get login settings from /settings/login endpoint
	 * Note: This endpoint does not require authentication
	 */
	async getLoginSettings(host: string, timeout?: number): Promise<ShellyLoginResponse> {
		return this.get(host, SHELLY_HTTP_ENDPOINTS.LOGIN, timeout) as Promise<ShellyLoginResponse>;
	}

	/**
	 * Generic HTTP GET request to a Shelly device with type-safe endpoint mapping
	 * Supports Basic HTTP authentication when username and password are provided
	 */
	private async get<E extends ShellyHttpEndpoint>(
		host: string,
		endpoint: E,
		timeout?: number,
		username?: string,
		password?: string,
	): Promise<ShellyHttpEndpointResponseMap[E]> {
		const url = `http://${host}${endpoint}`;
		const requestTimeout = timeout || this.DEFAULT_TIMEOUT;

		// Build headers
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		// Add a Basic Authentication header if credentials are provided
		if (username && password) {
			const credentials = Buffer.from(`${username}:${password}`).toString('base64');
			headers['Authorization'] = `Basic ${credentials}`;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new DevicesShellyV1Exception(`HTTP request failed: ${response.status} ${response.statusText}`);
			}

			const data = (await response.json()) as ShellyHttpEndpointResponseMap[E];

			return data;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new DevicesShellyV1Exception(`Request timeout after ${requestTimeout}ms for ${url}`);
				}

				throw new DevicesShellyV1Exception(`HTTP request failed: ${error.message}`);
			}

			throw new DevicesShellyV1Exception(`HTTP request failed: ${String(error)}`);
		}
	}
}
