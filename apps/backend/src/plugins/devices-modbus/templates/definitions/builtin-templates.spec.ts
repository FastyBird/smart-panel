import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { PropertyCategory } from '../../../../modules/devices/devices.constants';
import { DeviceValidationService } from '../../../../modules/devices/services/device-validation.service';
import { CreateModbusDeviceStructureDto } from '../../dto/create-device-structure.dto';
import { validateModbusStructure, withDeviceInformation } from '../../lib/structure-validation';
import { ModbusTemplateExpansion } from '../../lib/template-expander';
import { ModbusTemplatesService } from '../../services/modbus-templates.service';

const DEFINITIONS = __dirname;
const SCHEMA_PATH = join(__dirname, '../schema/modbus-templates.schema.json');
const PLACEHOLDER_ENDPOINT_ID = '00000000-0000-4000-8000-000000000000';

describe('built-in Modbus templates', () => {
	let userDirectory: string;
	let service: ModbusTemplatesService;
	let deviceValidation: DeviceValidationService;

	beforeEach(() => {
		userDirectory = mkdtempSync(join(tmpdir(), 'modbus-builtin-templates-'));

		const config = { get: (key: string) => (key === 'FB_CONFIG_PATH' ? userDirectory : undefined) };

		deviceValidation = new DeviceValidationService({} as never);
		service = new ModbusTemplatesService(config as unknown as NestConfigService, deviceValidation, {
			builtinDirectory: DEFINITIONS,
			schemaPath: SCHEMA_PATH,
		});

		jest.spyOn(Object.getPrototypeOf((service as unknown as { logger: object }).logger), 'log').mockImplementation();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		rmSync(userDirectory, { recursive: true, force: true });
	});

	/** Runs the same structure and specification checks that `POST devices` runs on a device structure. */
	const assertStructurallyValid = (expansion: ModbusTemplateExpansion): void => {
		const dto = plainToInstance(CreateModbusDeviceStructureDto, {
			...expansion,
			name: expansion.model,
			endpoint_id: PLACEHOLDER_ENDPOINT_ID,
		});

		expect(validateSync(dto)).toEqual([]);
		expect(
			validateModbusStructure(
				withDeviceInformation(dto, 'template'),
				(input) => deviceValidation.validateDeviceStructure(input).issues,
			),
		).toEqual([]);
	};

	const stateRead = (expansion: ModbusTemplateExpansion, channelIndex: number) => {
		const property = expansion.channels[channelIndex].properties.find(
			(entry) => entry.category === PropertyCategory.STATE,
		);

		return property?.read;
	};

	it('loads both built-in templates without errors', () => {
		const catalog = service.reload();

		expect(catalog.files.flatMap((entry) => entry.errors)).toEqual([]);
		expect(catalog.templates.map((entry) => entry.template.id).sort()).toEqual(['eletechsup-n4d8b08', 'qingjun-32di']);
		expect(catalog.templates.every((entry) => entry.source === 'builtin')).toBe(true);
	});

	describe('qingjun-32di', () => {
		it('expands to 32 digital inputs packed into holding registers 4 and 5', () => {
			service.reload();

			const expansion = service.preview('qingjun-32di', { unit_id: 2 });

			expect(expansion.unit_id).toBe(2);
			expect(expansion.channels).toHaveLength(32);
			expect(expansion.channels[0]).toMatchObject({ identifier: 'di_1', name: 'DI 1', category: 'binary_input' });
			expect(expansion.channels[31]).toMatchObject({ identifier: 'di_32', name: 'DI 32' });

			const points = [0, 15, 16, 31].map((index) => {
				const read = stateRead(expansion, index);

				return [read?.address, read?.bit];
			});

			expect(points).toEqual([
				[4, 0],
				[4, 15],
				[5, 0],
				[5, 15],
			]);
		});

		it('passes structural and specification validation', () => {
			service.reload();

			assertStructurallyValid(service.preview('qingjun-32di', { unit_id: 2 }));
		});
	});

	describe('eletechsup-n4d8b08', () => {
		it('expands to 8 relays and 8 inputs', () => {
			service.reload();

			const expansion = service.preview('eletechsup-n4d8b08', {});

			expect(expansion.channels).toHaveLength(16);
			expect(expansion.channels[0]).toMatchObject({ identifier: 'relay_1', name: 'Relay 1', category: 'switcher' });
			expect(expansion.channels[7]).toMatchObject({ identifier: 'relay_8', name: 'Relay 8' });
			expect(expansion.channels[8]).toMatchObject({ identifier: 'input_1', name: 'Input 1' });
			expect(expansion.channels[15]).toMatchObject({ identifier: 'input_8', name: 'Input 8' });
		});

		it('binds relay 1 to PDU 1 with distinct read and write value maps', () => {
			service.reload();

			const relay = service
				.preview('eletechsup-n4d8b08', {})
				.channels[0].properties.find((entry) => entry.category === PropertyCategory.ON);

			expect(relay?.read).toEqual({
				register_type: 'holding_register',
				address: 1,
				data_type: 'uint16',
				value_map: [
					{ raw: 1, value: true },
					{ raw: 0, value: false },
				],
			});
			expect(relay?.write).toEqual({
				register_type: 'holding_register',
				address: 1,
				data_type: 'uint16',
				value_map: [
					{ raw: 256, value: true },
					{ raw: 512, value: false },
				],
				write_function: 'single',
			});
		});

		it('binds relay 8 to PDU 8 and input 1 and input 8 to PDU 129 and 136', () => {
			service.reload();

			const expansion = service.preview('eletechsup-n4d8b08', {});
			const relay8 = expansion.channels[7].properties.find((entry) => entry.category === PropertyCategory.ON);

			expect(relay8?.read?.address).toBe(8);
			expect(relay8?.write?.address).toBe(8);
			expect(stateRead(expansion, 8)?.address).toBe(129);
			expect(stateRead(expansion, 15)?.address).toBe(136);
		});

		it('binds no register at PDU 253 or 254', () => {
			service.reload();

			const addresses = service
				.preview('eletechsup-n4d8b08', {})
				.channels.flatMap((channel) => channel.properties.flatMap((property) => [property.read, property.write]))
				.map((binding) => binding?.address);

			expect(addresses).not.toContain(253);
			expect(addresses).not.toContain(254);
		});

		it('passes structural and specification validation', () => {
			service.reload();

			assertStructurallyValid(service.preview('eletechsup-n4d8b08', {}));
		});
	});
});
