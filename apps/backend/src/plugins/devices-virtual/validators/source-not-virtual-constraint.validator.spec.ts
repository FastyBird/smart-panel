import { VirtualNestingNotAllowedException, VirtualSourceNotFoundException } from '../devices-virtual.exceptions';
import { VirtualDevicesService } from '../services/virtual-devices.service';

import { SourceNotVirtualConstraintValidator } from './source-not-virtual-constraint.validator';

describe('SourceNotVirtualConstraintValidator', () => {
	let validator: SourceNotVirtualConstraintValidator;
	let virtualDevicesService: { assertSourceNotVirtual: jest.Mock };

	beforeEach(() => {
		virtualDevicesService = { assertSourceNotVirtual: jest.fn() };
		validator = new SourceNotVirtualConstraintValidator(virtualDevicesService as unknown as VirtualDevicesService);
	});

	it('accepts a source property on a non-virtual device', async () => {
		virtualDevicesService.assertSourceNotVirtual.mockResolvedValue(undefined);

		await expect(validator.validate('phys-source')).resolves.toBe(true);
		expect(virtualDevicesService.assertSourceNotVirtual).toHaveBeenCalledWith('phys-source');
	});

	it('rejects a source property on a virtual device', async () => {
		virtualDevicesService.assertSourceNotVirtual.mockRejectedValue(new VirtualNestingNotAllowedException('nested'));

		await expect(validator.validate('virtual-source')).resolves.toBe(false);
	});

	it('rejects a missing source property', async () => {
		virtualDevicesService.assertSourceNotVirtual.mockRejectedValue(new VirtualSourceNotFoundException('missing'));

		await expect(validator.validate('missing')).resolves.toBe(false);
	});

	it('accepts an empty value so @IsOptional stays in control', async () => {
		await expect(validator.validate(undefined)).resolves.toBe(true);
		expect(virtualDevicesService.assertSourceNotVirtual).not.toHaveBeenCalled();
	});

	it('propagates an unexpected error rather than silently failing validation', async () => {
		virtualDevicesService.assertSourceNotVirtual.mockRejectedValue(new Error('db unavailable'));

		await expect(validator.validate('some-id')).rejects.toThrow('db unavailable');
	});
});
