import * as crypto from 'crypto';

import {
	HOMEKIT_FORBIDDEN_PINS,
	generateRandomHomeKitPin,
	generateRandomMacAddress,
	generateRandomSetupId,
} from './devices-homekit.constants';

jest.mock('crypto', () => {
	const actual = jest.requireActual<typeof import('crypto')>('crypto');
	return {
		...actual,
		randomInt: jest.fn((...args: [number, number]) => actual.randomInt(...args)),
	};
});

describe('devices-homekit.constants', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('generateRandomHomeKitPin', () => {
		it('generates a valid 8-digit PIN in XXX-XX-XXX format', () => {
			for (let i = 0; i < 50; i++) {
				const pin = generateRandomHomeKitPin();
				expect(pin).toMatch(/^\d{3}-\d{2}-\d{3}$/);
				expect(HOMEKIT_FORBIDDEN_PINS.has(pin)).toBe(false);
			}
		});

		it('rejects forbidden PIN patterns and regenerates a valid PIN', () => {
			const mockRandomInt = crypto.randomInt as unknown as jest.Mock;
			// Return forbidden 11111111 on first call, then valid 12345679 on second call
			mockRandomInt.mockReturnValueOnce(11111111).mockReturnValueOnce(12345679);

			const pin = generateRandomHomeKitPin();

			expect(mockRandomInt).toHaveBeenCalledTimes(2);
			expect(pin).toBe('123-45-679');
		});
	});

	describe('generateRandomMacAddress', () => {
		it('generates a valid MAC address with local administered bit set and unicast', () => {
			const mac = generateRandomMacAddress();
			expect(mac).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/);
			const firstByte = parseInt(mac.slice(0, 2), 16);
			expect((firstByte & 0x02) !== 0).toBe(true);
			expect((firstByte & 0x01) === 0).toBe(true);
		});
	});

	describe('generateRandomSetupId', () => {
		it('generates a 4-character alphanumeric setup ID', () => {
			const setupId = generateRandomSetupId();
			expect(setupId).toMatch(/^[0-9A-Z]{4}$/);
		});
	});
});
