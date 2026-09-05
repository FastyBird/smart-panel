import { randomBytes, randomInt } from 'crypto';

export const DEVICES_HOMEKIT_PLUGIN_PREFIX = 'devices-homekit';

export const DEVICES_HOMEKIT_PLUGIN_NAME = 'devices-homekit';

export const DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME = 'Devices HomeKit plugin';

export const DEVICES_HOMEKIT_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for managing the HomeKit Gateway, bridging Smart Panel devices to Apple Home.';

export const DEFAULT_HOMEKIT_PORT = 51826;

export const DEFAULT_HOMEKIT_BRIDGE_NAME = 'Smart Panel Bridge';

export const HOMEKIT_MAX_BRIDGED_ACCESSORIES = 149;

export const HOMEKIT_PAIRING_STORAGE_DIR = 'homekit';

export function generateRandomHomeKitPin(): string {
	const part1 = randomInt(100, 999).toString();
	const part2 = randomInt(10, 99).toString();
	const part3 = randomInt(100, 999).toString();
	return `${part1}-${part2}-${part3}`;
}

export function generateRandomMacAddress(): string {
	const bytes = randomBytes(6);
	// Set locally administered bit (bit 1) and clear multicast bit (bit 0)
	bytes[0] = (bytes[0] & 0xfe) | 0x02;
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0').toUpperCase())
		.join(':');
}

export function generateRandomSetupId(): string {
	const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const bytes = randomBytes(4);
	return Array.from(bytes)
		.map((b) => chars[b % chars.length])
		.join('');
}
