import { useContainer, validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { VirtualDevicesService } from '../services/virtual-devices.service';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';

import { CreateVirtualDeviceDto } from './create-device.dto';
import { UpdateVirtualDeviceDto } from './update-device.dto';

/**
 * Regression coverage for a subtlety discovered while wiring @ValidateCategoryAllowed onto the
 * inherited `category` field: class-validator does NOT merge a subclass's redeclared property
 * decorators with its parent's for the same property name — it replaces them entirely. A naive
 * override (redeclaring `category` with only the new decorator) would therefore silently drop
 * CreateDeviceDto/UpdateDeviceDto's own @IsNotEmpty/@IsEnum(DeviceCategory), letting any string
 * through as a virtual device's category. These tests exercise the real, decorated DTO classes end
 * to end (not mocks) to prove both the inherited and the new validator fire together.
 */
describe('category field validation on CreateVirtualDeviceDto / UpdateVirtualDeviceDto', () => {
	beforeAll(() => {
		// assertCategoryAllowed touches none of VirtualDevicesService's injected dependencies (it is a
		// plain array-membership check), so undefined stand-ins are safe here — this exercises the
		// real business rule, not a mock of it.
		const virtualDevicesService = new VirtualDevicesService(
			undefined as unknown as ChannelsPropertiesService,
			undefined as unknown as ChannelsService,
			undefined as unknown as DevicesService,
			undefined as unknown as VirtualPropertyIndexService,
			undefined as unknown as DeviceValidationService,
		);
		const categoryAllowedValidator = new CategoryAllowedConstraintValidator(virtualDevicesService);

		// A minimal stand-in for Nest's DI container, playing the same role `useContainer(app, ...)`
		// plays in main.ts / app.e2e-spec.ts: resolves the one constraint class these tests exercise
		// to a real, working instance; falls back to a bare `new` for anything else class-validator
		// asks for (matching `fallbackOnErrors`'s spirit for classes with no-arg constructors).
		useContainer(
			{
				get: <T>(someClass: new () => T): T =>
					(someClass === CategoryAllowedConstraintValidator ? categoryAllowedValidator : new someClass()) as T,
			},
			{ fallbackOnErrors: true },
		);
	});

	it('CreateVirtualDeviceDto still rejects a non-enum category (inherited @IsEnum was not dropped)', async () => {
		const dto = toInstance(CreateVirtualDeviceDto, {
			type: 'virtual',
			name: 'Living Room Light',
			category: 'not-a-real-category',
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'category' && !!error.constraints?.isEnum)).toBe(true);
	});

	it('CreateVirtualDeviceDto rejects a blocked-but-syntactically-valid category', async () => {
		const dto = toInstance(CreateVirtualDeviceDto, {
			type: 'virtual',
			name: 'Living Room Heater',
			category: DeviceCategory.HEATING_UNIT,
		});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'category' && !!error.constraints?.CategoryAllowed)).toBe(true);
	});

	it('CreateVirtualDeviceDto accepts a permitted category', async () => {
		const dto = toInstance(CreateVirtualDeviceDto, {
			type: 'virtual',
			name: 'Living Room Light',
			category: DeviceCategory.LIGHTING,
		});

		const errors = await validate(dto);

		expect(errors.filter((error) => error.property === 'category')).toHaveLength(0);
	});

	it('UpdateVirtualDeviceDto still rejects a non-enum category (inherited @IsEnum was not dropped)', async () => {
		const dto = toInstance(UpdateVirtualDeviceDto, { type: 'virtual', category: 'not-a-real-category' });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'category' && !!error.constraints?.isEnum)).toBe(true);
	});

	it('UpdateVirtualDeviceDto rejects a blocked-but-syntactically-valid category', async () => {
		const dto = toInstance(UpdateVirtualDeviceDto, { type: 'virtual', category: DeviceCategory.THERMOSTAT });

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'category' && !!error.constraints?.CategoryAllowed)).toBe(true);
	});

	it('UpdateVirtualDeviceDto still allows omitting category entirely (inherited @IsOptional was not dropped)', async () => {
		const dto = toInstance(UpdateVirtualDeviceDto, { type: 'virtual' });

		const errors = await validate(dto);

		expect(errors.filter((error) => error.property === 'category')).toHaveLength(0);
	});
});
