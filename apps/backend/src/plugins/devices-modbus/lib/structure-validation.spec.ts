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
});
