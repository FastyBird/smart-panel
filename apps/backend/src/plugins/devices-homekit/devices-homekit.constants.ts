import { randomBytes, randomInt } from 'crypto';

export const DEVICES_HOMEKIT_PLUGIN_PREFIX = 'devices-homekit';

export const DEVICES_HOMEKIT_PLUGIN_NAME = 'devices-homekit';

export const DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME = 'Devices HomeKit plugin';

export const DEVICES_HOMEKIT_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for managing the HomeKit Gateway, bridging Smart Panel devices to Apple Home.';

export const DEVICES_HOMEKIT_PLUGIN_EVENT_PREFIX = 'DevicesHomeKitPlugin';

export enum EventType {
	BRIDGE_STATUS_CHANGED = 'DevicesHomeKitPlugin.Bridge.StatusChanged',
}

export const DEFAULT_HOMEKIT_PORT = 51826;

export const DEFAULT_HOMEKIT_BRIDGE_NAME = 'Smart Panel Bridge';

export const HOMEKIT_MAX_BRIDGED_ACCESSORIES = 149;

export const HOMEKIT_PAIRING_STORAGE_DIR = 'homekit';

export const HOMEKIT_FORBIDDEN_PINS = new Set([
	'000-00-000',
	'111-11-111',
	'222-22-222',
	'333-33-333',
	'444-44-444',
	'555-55-555',
	'666-66-666',
	'777-77-777',
	'888-88-888',
	'999-99-999',
	'123-45-678',
	'876-54-321',
]);

/**
 * Generates an unbiased random 8-digit HomeKit pairing PIN in `XXX-XX-XXX` format.
 *
 * Utilizes cryptographically secure random integers and rejection sampling against
 * Apple's forbidden code set (`HOMEKIT_FORBIDDEN_PINS`).
 *
 * @returns A formatted 8-digit PIN string (e.g. `031-45-154`).
 */
export function generateRandomHomeKitPin(): string {
	let pin: string;
	do {
		const num = randomInt(0, 100_000_000).toString().padStart(8, '0');
		pin = `${num.slice(0, 3)}-${num.slice(3, 5)}-${num.slice(5, 8)}`;
	} while (HOMEKIT_FORBIDDEN_PINS.has(pin));

	return pin;
}

/**
 * Generates a random MAC address formatted as `XX:XX:XX:XX:XX:XX` for HomeKit device identity.
 *
 * Sets the locally administered bit and clears the multicast bit on the first octet
 * to ensure a valid unicast local MAC address.
 *
 * @returns A colon-separated uppercase MAC address string.
 */
export function generateRandomMacAddress(): string {
	const bytes = randomBytes(6);
	// Set locally administered bit (bit 1) and clear multicast bit (bit 0)
	bytes[0] = (bytes[0] & 0xfe) | 0x02;
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0').toUpperCase())
		.join(':');
}

/**
 * Generates a random 4-character alphanumeric Setup ID for HomeKit pairing.
 *
 * Used in mDNS advertisement records and setup URIs for Apple Home camera QR scanning.
 *
 * @returns A 4-character alphanumeric setup identifier (e.g. `SP01`).
 */
export function generateRandomSetupId(): string {
	const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const bytes = randomBytes(4);
	return Array.from(bytes)
		.map((b) => chars[b % chars.length])
		.join('');
}
