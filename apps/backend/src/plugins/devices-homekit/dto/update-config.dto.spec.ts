import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_HOMEKIT_PLUGIN_NAME, HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';

import { HomeKitUpdatePluginConfigDto } from './update-config.dto';

describe('HomeKitUpdatePluginConfigDto', () => {
	const createDto = (plain: Record<string, unknown>): HomeKitUpdatePluginConfigDto => {
		return toInstance(
			HomeKitUpdatePluginConfigDto,
			{
				type: DEVICES_HOMEKIT_PLUGIN_NAME,
				...plain,
			},
			{ excludeExtraneousValues: false },
		);
	};

	describe('PIN code validation', () => {
		it.each(Array.from(HOMEKIT_FORBIDDEN_PINS))('rejects forbidden PIN %s', (forbiddenPin) => {
			const dto = createDto({ pincode: forbiddenPin });
			const errors = validateSync(dto);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
			const pincodeError = errors.find((e) => e.property === 'pincode');
			expect(pincodeError?.constraints?.isNotForbiddenHomeKitPin).toBe(
				'[{"field":"pincode","reason":"PIN code is not allowed by Apple HomeKit."}]',
			);
		});

		it('accepts a valid PIN', () => {
			const dto = createDto({ pincode: '031-45-154' });
			const errors = validateSync(dto);

			expect(errors.filter((e) => e.property === 'pincode')).toHaveLength(0);
		});

		it('accepts an omitted PIN (undefined)', () => {
			const dto = createDto({});
			const errors = validateSync(dto);

			expect(dto.pincode).toBeUndefined();
			expect(errors.filter((e) => e.property === 'pincode')).toHaveLength(0);
		});

		it('rejects an explicit null PIN', () => {
			const dto = createDto({ pincode: null });
			const errors = validateSync(dto);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
			const pincodeError = errors.find((e) => e.property === 'pincode');
			expect(pincodeError?.constraints).toBeDefined();
		});

		it('rejects an empty string PIN', () => {
			const dto = createDto({ pincode: '' });
			const errors = validateSync(dto);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
		});

		it('rejects a whitespace-only PIN', () => {
			const dto = createDto({ pincode: '   ' });
			const errors = validateSync(dto);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
		});

		it('rejects an invalid PIN format', () => {
			const dto = createDto({ pincode: '12345' });
			const errors = validateSync(dto);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
		});
	});

	describe('bridge_name validation', () => {
		it('accepts a valid bridge name', () => {
			const dto = createDto({ bridge_name: 'Living Room Bridge' });
			const errors = validateSync(dto);

			expect(errors.filter((e) => e.property === 'bridge_name')).toHaveLength(0);
			expect(dto.bridge_name).toBe('Living Room Bridge');
		});

		it('accepts an omitted bridge name', () => {
			const dto = createDto({});
			const errors = validateSync(dto);

			expect(errors.filter((e) => e.property === 'bridge_name')).toHaveLength(0);
			expect(dto.bridge_name).toBeUndefined();
		});

		it('trims leading and trailing whitespace from valid bridge name', () => {
			const dto = createDto({ bridge_name: '  My Bridge  ' });
			const errors = validateSync(dto);

			expect(errors.filter((e) => e.property === 'bridge_name')).toHaveLength(0);
			expect(dto.bridge_name).toBe('My Bridge');
		});

		it('rejects a whitespace-only bridge name', () => {
			const dto = createDto({ bridge_name: '   ' });
			const errors = validateSync(dto);

			expect(errors.some((e) => e.property === 'bridge_name')).toBe(true);
			const error = errors.find((e) => e.property === 'bridge_name');
			expect(error?.constraints?.minLength).toBe('[{"field":"bridge_name","reason":"Bridge name cannot be empty."}]');
		});

		it('rejects an empty string bridge name', () => {
			const dto = createDto({ bridge_name: '' });
			const errors = validateSync(dto);

			expect(errors.some((e) => e.property === 'bridge_name')).toBe(true);
			const error = errors.find((e) => e.property === 'bridge_name');
			expect(error?.constraints?.minLength).toBe('[{"field":"bridge_name","reason":"Bridge name cannot be empty."}]');
		});
	});
});
