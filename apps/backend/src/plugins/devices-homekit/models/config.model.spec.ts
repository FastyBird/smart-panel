import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_HOMEKIT_PLUGIN_NAME, HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';

import { HomeKitConfigModel } from './config.model';

describe('HomeKitConfigModel', () => {
	const createModel = (plain: Record<string, unknown> = {}): HomeKitConfigModel => {
		return toInstance(
			HomeKitConfigModel,
			{
				type: DEVICES_HOMEKIT_PLUGIN_NAME,
				...plain,
			},
			{ excludeExtraneousValues: false },
		);
	};

	describe('PIN code validation', () => {
		it.each(Array.from(HOMEKIT_FORBIDDEN_PINS))('rejects forbidden PIN %s', (forbiddenPin) => {
			const model = createModel({ pincode: forbiddenPin });
			const errors = validateSync(model);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
			const error = errors.find((e) => e.property === 'pincode');
			expect(error?.constraints?.isNotForbiddenHomeKitPin).toBe(
				'[{"field":"pincode","reason":"PIN code is not allowed by Apple HomeKit."}]',
			);
		});

		it('accepts a valid PIN', () => {
			const model = createModel({ pincode: '031-45-154' });
			const errors = validateSync(model);

			expect(errors.filter((e) => e.property === 'pincode')).toHaveLength(0);
			expect(model.pincode).toBe('031-45-154');
		});

		it('rejects an empty string PIN', () => {
			const model = createModel({ pincode: '' });
			const errors = validateSync(model);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
		});

		it('rejects an invalid PIN format', () => {
			const model = createModel({ pincode: '123-45' });
			const errors = validateSync(model);

			expect(errors.some((e) => e.property === 'pincode')).toBe(true);
		});
	});

	describe('bridgeName validation', () => {
		it('accepts a valid bridge name', () => {
			const model = createModel({ bridge_name: 'Smart Bridge' });
			const errors = validateSync(model);

			expect(errors.filter((e) => e.property === 'bridgeName')).toHaveLength(0);
			expect(model.bridgeName).toBe('Smart Bridge');
		});

		it('trims whitespace on bridge name', () => {
			const model = createModel({ bridge_name: '   Trimmed Bridge   ' });
			const errors = validateSync(model);

			expect(errors.filter((e) => e.property === 'bridgeName')).toHaveLength(0);
			expect(model.bridgeName).toBe('Trimmed Bridge');
		});

		it('rejects a whitespace-only bridge name', () => {
			const model = createModel({ bridge_name: '    ' });
			const errors = validateSync(model);

			expect(errors.some((e) => e.property === 'bridgeName')).toBe(true);
			const error = errors.find((e) => e.property === 'bridgeName');
			expect(error?.constraints?.minLength).toBe('Bridge name cannot be empty');
		});

		it('rejects an empty string bridge name', () => {
			const model = createModel({ bridge_name: '' });
			const errors = validateSync(model);

			expect(errors.some((e) => e.property === 'bridgeName')).toBe(true);
			const error = errors.find((e) => e.property === 'bridgeName');
			expect(error?.constraints?.minLength).toBe('Bridge name cannot be empty');
		});
	});
});
