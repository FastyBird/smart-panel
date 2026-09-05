import { describe, expect, it, vi } from 'vitest';

import { HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';
import { HomeKitConfigEditFormSchema } from './config.schemas';

vi.mock('../../../modules/config', async () => {
	const schemas = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return { ConfigPluginEditFormSchema: schemas.ConfigPluginEditFormSchema };
});

const createValidForm = (overrides: Record<string, unknown> = {}) => ({
	type: 'devices-homekit',
	enabled: true,
	bridgeName: 'Smart Panel Bridge',
	port: 51826,
	pincode: '031-45-154',
	pincodeConfigured: true,
	username: 'CC:22:3D:E3:CE:30',
	setupId: 'SP01',
	mappedDeviceIds: [],
	...overrides,
});

describe('HomeKitConfigEditFormSchema', () => {
	it('accepts a valid configuration', () => {
		const parsed = HomeKitConfigEditFormSchema.safeParse(createValidForm());
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.bridgeName).toBe('Smart Panel Bridge');
			expect(parsed.data.pincode).toBe('031-45-154');
		}
	});

	it('rejects empty or whitespace-only bridge names', () => {
		expect(HomeKitConfigEditFormSchema.safeParse(createValidForm({ bridgeName: '' })).success).toBe(false);
		expect(HomeKitConfigEditFormSchema.safeParse(createValidForm({ bridgeName: '   ' })).success).toBe(false);
	});

	it('trims bridge name', () => {
		const parsed = HomeKitConfigEditFormSchema.safeParse(createValidForm({ bridgeName: '  Trimmed Bridge  ' }));
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.bridgeName).toBe('Trimmed Bridge');
		}
	});

	it.each(Array.from(HOMEKIT_FORBIDDEN_PINS))('rejects forbidden PIN %s', (forbiddenPin) => {
		const parsed = HomeKitConfigEditFormSchema.safeParse(createValidForm({ pincode: forbiddenPin }));
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(parsed.error.issues.some((i) => i.message === 'PIN code is not allowed by Apple HomeKit')).toBe(true);
		}
	});

	it('rejects malformed PIN formats', () => {
		for (const badPin of ['12345678', '123-456-78', 'abcdefgh', '12-345-678']) {
			const parsed = HomeKitConfigEditFormSchema.safeParse(createValidForm({ pincode: badPin }));
			expect(parsed.success).toBe(false);
			if (!parsed.success) {
				expect(parsed.error.issues.some((i) => i.message === 'PIN code must be in format XXX-XX-XXX')).toBe(true);
			}
		}
	});

	it('transforms blank PIN to undefined when pincodeConfigured is true', () => {
		for (const blankPin of ['', '   ', undefined]) {
			const parsed = HomeKitConfigEditFormSchema.safeParse(
				createValidForm({ pincode: blankPin, pincodeConfigured: true })
			);
			expect(parsed.success).toBe(true);
			if (parsed.success) {
				expect(parsed.data.pincode).toBeUndefined();
			}
		}
	});

	it('rejects blank or omitted PIN when pincodeConfigured is false or undefined', () => {
		for (const blankPin of ['', '   ', undefined]) {
			const parsedFalse = HomeKitConfigEditFormSchema.safeParse(
				createValidForm({ pincode: blankPin, pincodeConfigured: false })
			);
			expect(parsedFalse.success).toBe(false);
			if (!parsedFalse.success) {
				expect(parsedFalse.error.issues.some((i) => i.message === 'PIN code is required')).toBe(true);
			}

			const parsedUndef = HomeKitConfigEditFormSchema.safeParse(
				createValidForm({ pincode: blankPin, pincodeConfigured: undefined })
			);
			expect(parsedUndef.success).toBe(false);
			if (!parsedUndef.success) {
				expect(parsedUndef.error.issues.some((i) => i.message === 'PIN code is required')).toBe(true);
			}
		}
	});
});
