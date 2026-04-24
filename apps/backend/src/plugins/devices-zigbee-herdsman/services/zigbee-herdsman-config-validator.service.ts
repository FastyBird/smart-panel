import * as fs from 'fs';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ALLOWED_CHANNELS_MAX,
	ALLOWED_CHANNELS_MIN,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
} from '../devices-zigbee-herdsman.constants';
import { ZigbeeHerdsmanConfigModel } from '../models/config.model';

@Injectable()
export class ZigbeeHerdsmanConfigValidatorService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'ConfigValidatorService',
	);

	validate(config: ZigbeeHerdsmanConfigModel): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Validate serial port path
		if (!config.serial.path) {
			errors.push('Serial port path is required');
		} else if (this.isTcpPath(config.serial.path)) {
			// Network-attached coordinators (e.g. SLZB-06, tcp://host:port)
			// validated by format only — actual connectivity is checked at start()
			const parsed = this.parseTcpPath(config.serial.path);
			if (!parsed) {
				errors.push(`Invalid TCP path "${config.serial.path}". Expected format: tcp://host:port`);
			}
		} else {
			// Local serial port — check file accessibility
			try {
				fs.accessSync(config.serial.path, fs.constants.R_OK | fs.constants.W_OK);
			} catch {
				errors.push(`Serial port ${config.serial.path} is not accessible`);
			}
		}

		// Validate channel
		if (config.network.channel < ALLOWED_CHANNELS_MIN || config.network.channel > ALLOWED_CHANNELS_MAX) {
			errors.push(`Channel must be between ${ALLOWED_CHANNELS_MIN} and ${ALLOWED_CHANNELS_MAX}`);
		}

		// Validate network key length
		if (config.network.networkKey && config.network.networkKey.length !== 16) {
			errors.push('Network key must be exactly 16 bytes');
		}

		// Validate extended PAN ID length
		if (config.network.extendedPanId && config.network.extendedPanId.length !== 8) {
			errors.push('Extended PAN ID must be exactly 8 bytes');
		}

		return { valid: errors.length === 0, errors };
	}

	private isTcpPath(path: string): boolean {
		return path.startsWith('tcp://');
	}

	private parseTcpPath(path: string): { host: string; port: number } | null {
		const match = /^tcp:\/\/([^:]+):(\d+)$/.exec(path);
		if (!match) {
			return null;
		}

		const port = parseInt(match[2], 10);
		if (port < 1 || port > 65535) {
			return null;
		}

		return { host: match[1], port };
	}
}
