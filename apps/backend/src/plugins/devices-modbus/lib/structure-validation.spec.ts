import { plainToInstance } from 'class-transformer';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ModbusDataType, ModbusRegisterType, ModbusWriteFunction } from '../devices-modbus.constants';
import { CreateModbusDeviceStructureDto } from '../dto/create-device-structure.dto';

import { validateModbusStructure, withDeviceInformation } from './structure-validation';

const SERIAL = '127.0.0.1:502#1';

/** The Eletechsup N4D8B08 relay board reduced to one relay: read and write use different raw values. */
const singleRelay = (omitRead = false): CreateModbusDeviceStructureDto => {
	const holding = ModbusRegisterType.HOLDING_REGISTER;

	return plainToInstance(CreateModbusDeviceStructureDto, {
		name: 'N4D8B08',
		category: DeviceCategory.SWITCHER,
		endpoint_id: 'endpoint',
		unit_id: 1,
		channels: [
			{
				identifier: 'relay_1',
				name: 'Relay 1',
				category: ChannelCategory.SWITCHER,
				properties: [
					{
						category: PropertyCategory.ON,
						data_type: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
						...(omitRead
							? {}
							: {
									read: {
										register_type: holding,
										address: 1,
										data_type: ModbusDataType.UINT16,
										value_map: [
											{ raw: 1, value: true },
											{ raw: 0, value: false },
										],
									},
								}),
						write: {
							register_type: holding,
							address: 1,
							data_type: ModbusDataType.UINT16,
							value_map: [
								{ raw: 256, value: true },
								{ raw: 512, value: false },
							],
							write_function: ModbusWriteFunction.SINGLE,
						},
					},
				],
			},
		],
	});
};

describe('structure validation', () => {
	it('adds one device_information channel carrying the serial number', () => {
		const structure = withDeviceInformation(singleRelay(), SERIAL);
		const information = structure.channels.filter((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION);

		expect(information).toHaveLength(1);
		expect(
			information[0].properties.find((property) => property.category === PropertyCategory.SERIAL_NUMBER)?.static_value,
		).toBe(SERIAL);
	});

	it('accepts the relay fixture when the specification validator reports nothing', () => {
		const structure = withDeviceInformation(singleRelay(), SERIAL);

		expect(validateModbusStructure(structure, () => [])).toEqual([]);
	});

	it('rejects a readable property without a read binding', () => {
		const structure = withDeviceInformation(singleRelay(true), SERIAL);
		const issues = validateModbusStructure(structure, () => []);

		expect(issues.filter((issue) => issue.field === 'channels[0].properties[0].read')).toHaveLength(1);
	});

	describe('button events and long press', () => {
		const READ = 'channels[0].properties[0].read';

		const withRead = (channel: ChannelCategory, property: PropertyCategory, dataType: DataTypeType, read: object) =>
			withDeviceInformation(
				plainToInstance(CreateModbusDeviceStructureDto, {
					name: 'Input board',
					category: DeviceCategory.SWITCHER,
					endpoint_id: 'endpoint',
					unit_id: 1,
					channels: [
						{
							identifier: 'channel_1',
							name: 'Channel 1',
							category: channel,
							properties: [
								{
									category: property,
									data_type: dataType,
									permissions:
										property === PropertyCategory.EVENT ? [PermissionType.EVENT_ONLY] : [PermissionType.READ_ONLY],
									read,
								},
							],
						},
					],
				}),
				SERIAL,
			);

		const button = (read: object) => withRead(ChannelCategory.BUTTON, PropertyCategory.EVENT, DataTypeType.ENUM, read);
		const state = (read: object) =>
			withRead(ChannelCategory.BINARY_INPUT, PropertyCategory.STATE, DataTypeType.BOOL, read);

		const level = { register_type: ModbusRegisterType.DISCRETE_INPUT, address: 0, data_type: ModbusDataType.BOOL };
		const issuesOn = (structure: CreateModbusDeviceStructureDto) =>
			validateModbusStructure(structure, () => []).filter((issue) => issue.field.startsWith(READ));

		it('accepts a bool read binding on button.event', () => {
			expect(issuesOn(button(level))).toEqual([]);
		});

		it('accepts a bit-in-register read binding on button.event', () => {
			expect(
				issuesOn(
					button({
						register_type: ModbusRegisterType.HOLDING_REGISTER,
						address: 0,
						data_type: ModbusDataType.BOOL,
						bit: 3,
					}),
				),
			).toEqual([]);
		});

		it('refuses a read binding on another ev property', () => {
			const structure = withRead(ChannelCategory.BUTTON, PropertyCategory.EVENT, DataTypeType.ENUM, level);

			structure.channels[0].properties[0].category = PropertyCategory.LAST_EVENT;

			const issues = issuesOn(structure);

			expect(issues).toHaveLength(1);
			expect(issues[0].field).toBe(READ);
			expect(issues[0].reason).toContain('button event');
		});

		it('refuses a non-bool level for button.event', () => {
			const issues = issuesOn(
				button({ register_type: ModbusRegisterType.HOLDING_REGISTER, address: 0, data_type: ModbusDataType.UINT16 }),
			);

			expect(issues.map((issue) => issue.field)).toEqual([`${READ}.data_type`]);
		});

		it('refuses long_press_ms outside button.event', () => {
			const issues = issuesOn(state({ ...level, long_press_ms: 800 }));

			expect(issues.map((issue) => issue.field)).toEqual([`${READ}.long_press_ms`]);
		});

		it.each([99, 10001, 150.5])('refuses long_press_ms %s', (value) => {
			expect(issuesOn(button({ ...level, long_press_ms: value })).map((issue) => issue.field)).toEqual([
				`${READ}.long_press_ms`,
			]);
		});

		it.each([100, 10000])('accepts long_press_ms %s', (value) => {
			expect(issuesOn(button({ ...level, long_press_ms: value }))).toEqual([]);
		});

		it('refuses scale 0', () => {
			const read = { register_type: ModbusRegisterType.INPUT_REGISTER, address: 0, data_type: ModbusDataType.UINT16 };

			expect(issuesOn(state({ ...read, scale: 0 })).map((issue) => issue.field)).toEqual([`${READ}.scale`]);
		});
	});
});
