import { DevicesService } from '../services/devices.service';

import { DeviceNotHiddenConstraintValidator } from './device-not-hidden-constraint.validator';

describe('DeviceNotHiddenConstraintValidator', () => {
	let validator: DeviceNotHiddenConstraintValidator;
	let devicesService: { findOne: jest.Mock };

	beforeEach(() => {
		devicesService = { findOne: jest.fn() };
		validator = new DeviceNotHiddenConstraintValidator(devicesService as unknown as DevicesService);
	});

	it('accepts a visible device', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'a', hidden: false });

		await expect(validator.validate('a')).resolves.toBe(true);
	});

	it('rejects a hidden device', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'a', hidden: true });

		await expect(validator.validate('a')).resolves.toBe(false);
	});

	it('rejects a missing device', async () => {
		devicesService.findOne.mockResolvedValue(null);

		await expect(validator.validate('a')).resolves.toBe(false);
	});

	it('accepts an empty value so @IsOptional stays in control', async () => {
		await expect(validator.validate(undefined)).resolves.toBe(true);
		expect(devicesService.findOne).not.toHaveBeenCalled();
	});
});
