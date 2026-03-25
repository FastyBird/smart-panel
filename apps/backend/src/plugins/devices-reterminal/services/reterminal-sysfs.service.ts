import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	DEVICES_RETERMINAL_PLUGIN_NAME,
	RETERMINAL_MODEL_STRINGS,
	RETERMINAL_SYSFS,
	ReTerminalVariant,
} from '../devices-reterminal.constants';

/**
 * Low-level service for reading/writing to Linux sysfs and procfs.
 * Handles all hardware I/O for reTerminal peripherals.
 */
@Injectable()
export class ReTerminalSysfsService {
	private readonly logger = createExtensionLogger(DEVICES_RETERMINAL_PLUGIN_NAME, ReTerminalSysfsService.name);

	/**
	 * Detect which reTerminal variant (if any) is present on this system.
	 *
	 * Detection strategy:
	 * 1. Check /proc/device-tree/model for "reTerminal" string
	 * 2. Fall back to probing reTerminal-specific sysfs paths (LEDs)
	 *    since the device-tree model on CM4-based boards reports
	 *    "Raspberry Pi Compute Module 4", not the board name.
	 */
	async detectVariant(): Promise<ReTerminalVariant | null> {
		// Strategy 1: Check device-tree model string
		try {
			const model = await this.readFile(RETERMINAL_SYSFS.DEVICE_TREE_MODEL);
			const modelStr = model.replace(/\0/g, '').trim();

			this.logger.log(`Detected device model: ${modelStr}`);

			if (modelStr.includes(RETERMINAL_MODEL_STRINGS.RETERMINAL_DM)) {
				return ReTerminalVariant.RETERMINAL_DM;
			}

			if (modelStr.includes(RETERMINAL_MODEL_STRINGS.RETERMINAL)) {
				return ReTerminalVariant.RETERMINAL;
			}
		} catch {
			this.logger.debug('Could not read device tree model');
		}

		// Strategy 2: Probe reTerminal-specific sysfs hardware paths
		if (existsSync(RETERMINAL_SYSFS.STA_LED_DM)) {
			this.logger.log('Detected reTerminal DM via sysfs LED path');

			return ReTerminalVariant.RETERMINAL_DM;
		}

		if (existsSync(RETERMINAL_SYSFS.USR_LED) || existsSync(RETERMINAL_SYSFS.STA_LED_GREEN)) {
			this.logger.log('Detected reTerminal via sysfs LED path');

			return ReTerminalVariant.RETERMINAL;
		}

		return null;
	}

	/**
	 * Read a sysfs/procfs file and return its content as a trimmed string.
	 */
	async readFile(filePath: string): Promise<string> {
		const content = await fs.readFile(filePath, 'utf-8');

		return content.trim();
	}

	/**
	 * Write a value to a sysfs file.
	 */
	async writeFile(filePath: string, value: string): Promise<void> {
		await fs.writeFile(filePath, value);
	}

	/**
	 * Read CPU temperature from thermal zone (returns value in °C).
	 */
	async readCpuTemperature(): Promise<number | null> {
		try {
			const raw = await this.readFile(RETERMINAL_SYSFS.THERMAL_ZONE);

			// Thermal zone reports in millidegrees Celsius
			return parseInt(raw, 10) / 1000;
		} catch {
			return null;
		}
	}

	/**
	 * Read LED brightness (0-255).
	 */
	async readLedBrightness(ledPath: string): Promise<number | null> {
		try {
			const raw = await this.readFile(ledPath);

			return parseInt(raw, 10);
		} catch {
			return null;
		}
	}

	/**
	 * Find IIO device by name (e.g., light sensor or accelerometer).
	 */
	async findIioDevice(deviceName: string): Promise<string | null> {
		try {
			const iioBase = RETERMINAL_SYSFS.IIO_DEVICES;
			const devices = await fs.readdir(iioBase);

			for (const device of devices) {
				if (!device.startsWith('iio:device')) continue;

				try {
					const name = await this.readFile(path.join(iioBase, device, 'name'));

					if (name.includes(deviceName)) {
						return path.join(iioBase, device);
					}
				} catch {
					continue;
				}
			}
		} catch {
			this.logger.debug(`IIO devices path not accessible`);
		}

		return null;
	}

	/**
	 * Read IIO device attribute (e.g., raw sensor value).
	 */
	async readIioAttribute(devicePath: string, attribute: string): Promise<string | null> {
		try {
			return await this.readFile(path.join(devicePath, attribute));
		} catch {
			return null;
		}
	}

	/**
	 * Get the serial number from CPU info.
	 */
	async getSerialNumber(): Promise<string> {
		try {
			const cpuInfo = await this.readFile('/proc/cpuinfo');
			const match = cpuInfo.match(/Serial\s*:\s*(\S+)/);

			return match?.[1] ?? 'unknown';
		} catch {
			return 'unknown';
		}
	}

	/**
	 * Get the firmware/OS version.
	 */
	async getFirmwareVersion(): Promise<string> {
		try {
			const version = await this.readFile('/proc/version');
			const match = version.match(/Linux version (\S+)/);

			return match?.[1] ?? 'unknown';
		} catch {
			return 'unknown';
		}
	}
}
