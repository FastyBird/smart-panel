import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';

import { ModbusBindingDto } from './binding.dto';
import { CreateModbusDeviceStructureDto } from './create-device-structure.dto';
import { CreateModbusDeviceDto } from './create-device.dto';
import { CreateModbusEndpointDto } from './create-endpoint.dto';
import { UpdateModbusDeviceDto } from './update-device.dto';
import { UpdateModbusEndpointDto } from './update-endpoint.dto';

type DtoClass = new () => object;

/** Validation errors of one field only, so unrelated required fields of the DTO do not matter. */
const fieldErrors = async (dto: DtoClass, field: string, value: unknown): Promise<ValidationError[]> => {
	const errors = await validate(plainToInstance(dto, { [field]: value }));

	return errors.filter((error) => error.property === field);
};

const DEVICE_DTOS: Array<[string, DtoClass]> = [
	['CreateModbusDeviceDto', CreateModbusDeviceDto],
	['UpdateModbusDeviceDto', UpdateModbusDeviceDto],
	['CreateModbusDeviceStructureDto', CreateModbusDeviceStructureDto],
];

const ENDPOINT_DTOS: Array<[string, DtoClass]> = [
	['CreateModbusEndpointDto', CreateModbusEndpointDto],
	['UpdateModbusEndpointDto', UpdateModbusEndpointDto],
];

describe('Modbus DTO validation', () => {
	describe.each(DEVICE_DTOS)('%s', (_name, dto) => {
		it('accepts a template revision (16 hex characters)', async () => {
			expect(await fieldErrors(dto, 'template_revision', '3f2a9c1b7d4e6a05')).toEqual([]);
		});

		it.each([
			['a number', 3],
			['an empty string', ''],
			['a string over 128 characters', 'x'.repeat(129)],
		])('refuses a template revision that is %s', async (_case, value) => {
			expect(await fieldErrors(dto, 'template_revision', value)).not.toEqual([]);
		});

		it('caps the poll interval at one day', async () => {
			expect(await fieldErrors(dto, 'poll_interval_ms', 86_400_000)).toEqual([]);
			expect(await fieldErrors(dto, 'poll_interval_ms', 86_400_001)).not.toEqual([]);
		});
	});

	describe('UpdateModbusDeviceDto', () => {
		it.each(['endpoint_id', 'unit_id'])('accepts an omitted %s', async (field) => {
			expect(await fieldErrors(UpdateModbusDeviceDto, field, undefined)).toEqual([]);
		});

		it.each(['endpoint_id', 'unit_id'])('refuses a null %s', async (field) => {
			expect(await fieldErrors(UpdateModbusDeviceDto, field, null)).not.toEqual([]);
		});

		it('accepts a valid endpoint and unit', async () => {
			expect(await fieldErrors(UpdateModbusDeviceDto, 'endpoint_id', 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6')).toEqual(
				[],
			);
			expect(await fieldErrors(UpdateModbusDeviceDto, 'unit_id', 0)).toEqual([]);
		});
	});

	describe.each(ENDPOINT_DTOS)('%s', (_name, dto) => {
		it.each(['connect_timeout_ms', 'request_timeout_ms', 'inter_request_delay_ms'])(
			'caps %s at 60000 ms',
			async (field) => {
				expect(await fieldErrors(dto, field, 60_000)).toEqual([]);
				expect(await fieldErrors(dto, field, 60_001)).not.toEqual([]);
				// Above 2^31-1 ms a Node timer fires after 1 ms.
				expect(await fieldErrors(dto, field, 2 ** 31)).not.toEqual([]);
			},
		);

		it('caps max_in_flight at 16', async () => {
			expect(await fieldErrors(dto, 'max_in_flight', 16)).toEqual([]);
			expect(await fieldErrors(dto, 'max_in_flight', 17)).not.toEqual([]);
		});
	});

	describe('ModbusBindingDto', () => {
		it('caps the poll interval override at one day', async () => {
			expect(await fieldErrors(ModbusBindingDto, 'poll_interval_ms', 86_400_000)).toEqual([]);
			expect(await fieldErrors(ModbusBindingDto, 'poll_interval_ms', 86_400_001)).not.toEqual([]);
		});
	});
});
