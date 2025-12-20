import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DESCRIPTORS, DEVICES_SHELLY_V1_PLUGIN_NAME, SHELLY_AUTH_USERNAME } from '../devices-shelly-v1.constants';
import { DevicesShellyV1PluginGetInfo } from '../dto/shelly-v1-probe.dto';
import { ShellyInfoResponse, ShellyStatusResponse } from '../interfaces/shelly-http.interface';
import { ShellyV1DeviceInfoModel } from '../models/shelly-v1.model';

import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

/**
 * Service for probing Shelly V1 devices via HTTP
 * Used for device discovery and validation without creating database entries
 */
@Injectable()
export class ShellyV1ProbeService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1ProbeService',
	);

	constructor(private readonly httpClient: ShellyV1HttpClientService) {}

	/**
	 * Probe a Shelly V1 device at the given hostname
	 * Returns device information, auth status, and descriptor match without creating DB entries
	 */
	async probeDevice(request: DevicesShellyV1PluginGetInfo): Promise<ShellyV1DeviceInfoModel> {
		const { hostname, password } = request;
		const host = hostname;

		this.logger.debug(`Probing device at ${host}`);

		const response: ShellyV1DeviceInfoModel = {
			reachable: false,
			authRequired: false,
			host,
		};

		let shellyInfo: ShellyInfoResponse | null = null;
		let statusInfo: ShellyStatusResponse | null = null;

		// Step 1: Try to fetch /shelly endpoint (no auth required)
		try {
			shellyInfo = await this.httpClient.getDeviceInfo(host);
			response.reachable = true;
			response.authRequired = shellyInfo.auth;
			response.mac = shellyInfo.mac;
			response.model = shellyInfo.type;
			response.firmware = shellyInfo.fw;

			this.logger.debug(`Device at ${host} is reachable. Type: ${shellyInfo.type}, Auth: ${shellyInfo.auth}`);
		} catch (error) {
			this.logger.warn(`Failed to reach device at ${host}: ${error instanceof Error ? error.message : String(error)}`);

			return response; // Device not reachable
		}

		// Step 2: If auth is required, validate credentials
		if (shellyInfo.auth) {
			if (password) {
				// Try to fetch /status with credentials to validate auth
				try {
					statusInfo = await this.httpClient.getDeviceStatus(host, undefined, SHELLY_AUTH_USERNAME, password);
					response.authValid = true;
					response.ip = statusInfo.wifi_sta.ip;

					this.logger.debug(`Auth credentials valid for ${host}`);
				} catch (error) {
					response.authValid = false;

					this.logger.warn(
						`Auth credentials invalid for ${host}: ${error instanceof Error ? error.message : String(error)}`,
					);

					// Still continue to return basic info from /shelly
				}

				// If auth is valid, settings endpoint is also available but not fetched for now
			} else {
				// Auth required but no password provided
				response.authValid = undefined; // Cannot validate

				this.logger.debug(`Auth required for ${host} but no password provided`);
			}
		} else {
			// No auth required, fetch /status and /settings without credentials
			try {
				statusInfo = await this.httpClient.getDeviceStatus(host);
				response.ip = statusInfo.wifi_sta.ip;

				this.logger.debug(`Status fetched for ${host}`);
			} catch (error) {
				this.logger.warn(
					`Failed to fetch status for ${host}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		// Step 3: Match device to DESCRIPTORS
		if (shellyInfo?.type) {
			const descriptorMatch = this.findDescriptorForDevice(shellyInfo.type);

			if (descriptorMatch) {
				response.deviceType = descriptorMatch.descriptor.name;
				response.description = `${descriptorMatch.descriptor.name} (${shellyInfo.type})`;

				this.logger.debug(`Device ${host} matched to descriptor: ${descriptorMatch.key}`);
			} else {
				this.logger.warn(`No descriptor found for device type: ${shellyInfo.type}`);
			}
		}

		return response;
	}

	/**
	 * Find the descriptor that matches the device type
	 * Matches against the descriptor key (e.g., "SHELLY1") or model strings (e.g., "SHSW-1")
	 */
	private findDescriptorForDevice(
		deviceType: string,
	): { key: string; descriptor: (typeof DESCRIPTORS)[string] } | null {
		// First, try an exact match on a descriptor key
		if (deviceType in DESCRIPTORS) {
			return {
				key: deviceType,
				descriptor: DESCRIPTORS[deviceType],
			};
		}

		// Try to match against the model array in each descriptor
		for (const [key, descriptor] of Object.entries(DESCRIPTORS)) {
			if (descriptor.models.includes(deviceType)) {
				return {
					key,
					descriptor,
				};
			}
		}

		return null;
	}
}
