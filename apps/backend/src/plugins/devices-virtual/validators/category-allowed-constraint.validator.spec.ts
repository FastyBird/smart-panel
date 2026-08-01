import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { VirtualCategoryNotSupportedException } from '../devices-virtual.exceptions';
import { VirtualDevicesService } from '../services/virtual-devices.service';

import { CategoryAllowedConstraintValidator } from './category-allowed-constraint.validator';

describe('CategoryAllowedConstraintValidator', () => {
	let validator: CategoryAllowedConstraintValidator;
	let virtualDevicesService: { assertCategoryAllowed: jest.Mock };

	beforeEach(() => {
		virtualDevicesService = { assertCategoryAllowed: jest.fn() };
		validator = new CategoryAllowedConstraintValidator(virtualDevicesService as unknown as VirtualDevicesService);
	});

	it('accepts a permitted category', () => {
		expect(validator.validate(DeviceCategory.LIGHTING)).toBe(true);
		expect(virtualDevicesService.assertCategoryAllowed).toHaveBeenCalledWith(DeviceCategory.LIGHTING);
	});

	it('rejects a blocked category', () => {
		virtualDevicesService.assertCategoryAllowed.mockImplementation(() => {
			throw new VirtualCategoryNotSupportedException('blocked');
		});

		expect(validator.validate(DeviceCategory.HEATING_UNIT)).toBe(false);
	});

	it('accepts an empty value so @IsOptional/@IsNotEmpty stays in control', () => {
		expect(validator.validate(undefined)).toBe(true);
		expect(virtualDevicesService.assertCategoryAllowed).not.toHaveBeenCalled();
	});

	it('propagates an unexpected error rather than silently failing validation', () => {
		virtualDevicesService.assertCategoryAllowed.mockImplementation(() => {
			throw new Error('unexpected');
		});

		expect(() => validator.validate(DeviceCategory.LIGHTING)).toThrow('unexpected');
	});
});
