import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ModbusByteOrder, ModbusDataType, ModbusFraming, ModbusRegisterType } from '../devices-modbus.constants';
import { ProbeModbusPointsDto, ProbeModbusReadDto, ProbeModbusWriteDto } from '../dto/probe.dto';
import { ModbusProbeService } from '../services/modbus-probe.service';

import { ModbusProbeController } from './modbus-probe.controller';

const error = { kind: 'exception' as const, exceptionCode: 2, message: 'Illegal data address' };

describe('ModbusProbeController', () => {
	let service: { read: jest.Mock; readPoints: jest.Mock; write: jest.Mock };
	let controller: ModbusProbeController;

	beforeEach(() => {
		service = {
			read: jest.fn().mockResolvedValue({ ok: true, values: [10, 11], error: null, durationMs: 4 }),
			readPoints: jest.fn().mockResolvedValue({
				ok: true,
				points: [{ key: 'a', raw: [10], value: 10, error: null }],
				error: null,
				durationMs: 5,
			}),
			write: jest.fn().mockResolvedValue({ ok: false, error, durationMs: 6 }),
		};
		controller = new ModbusProbeController(service as unknown as ModbusProbeService);
	});

	it.each(['read', 'points', 'write'] as const)('restricts %s to owners and admins', (handler) => {
		expect(Reflect.getMetadata(ROLES_KEY, ModbusProbeController.prototype[handler])).toEqual([
			UserRole.OWNER,
			UserRole.ADMIN,
		]);
	});

	it.each([
		['read', 60],
		['points', 60],
		['write', 10],
	] as const)('throttles %s to %i requests a minute', (handler, limit) => {
		const method = ModbusProbeController.prototype[handler];

		expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, method)).toBe(limit);
		expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, method)).toBe(60000);
	});

	it('maps the unsaved details of a read to the service target and wraps the result', async () => {
		const dto = Object.assign(new ProbeModbusReadDto(), {
			host: '10.0.0.5',
			port: 502,
			framing: ModbusFraming.RTU_OVER_TCP,
			connect_timeout_ms: 700,
			unit_id: 3,
			register_type: ModbusRegisterType.HOLDING_REGISTER,
			address: 4,
			count: 2,
		});

		const response = await controller.read({ data: dto });

		expect(service.read).toHaveBeenCalledWith(
			{
				host: '10.0.0.5',
				port: 502,
				framing: ModbusFraming.RTU_OVER_TCP,
				connectTimeoutMs: 700,
				requestTimeoutMs: undefined,
			},
			{ unitId: 3, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 4, count: 2 },
		);
		expect(response.data).toMatchObject({ ok: true, values: [10, 11], error: null, duration_ms: 4 });
	});

	it('maps a saved endpoint to an endpoint target', async () => {
		const dto = Object.assign(new ProbeModbusReadDto(), {
			endpoint_id: 'ep-1',
			unit_id: 1,
			register_type: ModbusRegisterType.COIL,
			address: 0,
			count: 1,
		});

		await controller.read({ data: dto });

		expect(service.read).toHaveBeenCalledWith({ endpointId: 'ep-1' }, expect.objectContaining({ count: 1 }));
	});

	it.each([
		['neither form', {}],
		['both forms', { endpoint_id: 'ep-1', host: '10.0.0.5', port: 502, framing: ModbusFraming.TCP }],
		['host without port', { host: '10.0.0.5', framing: ModbusFraming.TCP }],
		['host without framing', { host: '10.0.0.5', port: 502 }],
		['timeouts with an endpoint', { endpoint_id: 'ep-1', request_timeout_ms: 500 }],
	])('refuses %s with a 400 on endpoint_id', async (_label, target) => {
		const dto = Object.assign(new ProbeModbusReadDto(), {
			...target,
			unit_id: 1,
			register_type: ModbusRegisterType.COIL,
			address: 0,
			count: 1,
		});

		await expect(controller.read({ data: dto })).rejects.toMatchObject({
			response: { message: [expect.stringContaining('"field":"endpoint_id"')] },
		});
		expect(service.read).not.toHaveBeenCalled();
	});

	it('maps points with binding defaults and the read limits', async () => {
		const dto = Object.assign(new ProbeModbusPointsDto(), {
			endpoint_id: 'ep-1',
			unit_id: 2,
			word_order: ModbusByteOrder.LITTLE,
			max_read_registers: 10,
			points: [
				{
					key: 'temp',
					binding: {
						register_type: ModbusRegisterType.INPUT_REGISTER,
						address: 7,
						data_type: ModbusDataType.UINT16,
						scale: 0.1,
					},
				},
				{
					key: 'bit',
					binding: {
						register_type: ModbusRegisterType.HOLDING_REGISTER,
						address: 1,
						data_type: ModbusDataType.BOOL,
						bit: 3,
						invert: true,
						value_map: [{ raw: 1, value: 'on' }],
						write_function: 'multiple',
					},
				},
			],
		});

		const response = await controller.points({ data: dto });

		expect(service.readPoints).toHaveBeenCalledWith(
			{ endpointId: 'ep-1' },
			[
				{
					key: 'temp',
					binding: {
						registerType: ModbusRegisterType.INPUT_REGISTER,
						address: 7,
						dataType: ModbusDataType.UINT16,
						bit: null,
						byteOrder: null,
						wordOrder: null,
						scale: 0.1,
						offset: 0,
						invert: false,
						valueMap: null,
						writeFunction: null,
					},
				},
				expect.anything(),
			],
			{
				unitId: 2,
				byteOrder: ModbusByteOrder.BIG,
				wordOrder: ModbusByteOrder.LITTLE,
				limits: { maxRegisters: 10, maxBits: 2000, maxGap: 0 },
			},
		);
		const sent = (service.readPoints.mock.calls[0] as [unknown, { key: string; binding: object }[]])[1];

		expect(sent[1]).toMatchObject({
			key: 'bit',
			binding: { bit: 3, scale: 1, invert: true, valueMap: [{ raw: 1, value: 'on' }], writeFunction: 'multiple' },
		});
		expect(response.data.points[0]).toMatchObject({ key: 'a', raw: [10], value: 10, error: null });
	});

	it('maps a write and reports a device failure as a 200 result with snake-case error fields', async () => {
		const dto = Object.assign(new ProbeModbusWriteDto(), {
			endpoint_id: 'ep-1',
			unit_id: 1,
			value: 99,
			byte_order: ModbusByteOrder.LITTLE,
			binding: {
				register_type: ModbusRegisterType.HOLDING_REGISTER,
				address: 7,
				data_type: ModbusDataType.UINT16,
			},
		});

		const response = await controller.write({ data: dto });

		expect(service.write).toHaveBeenCalledWith(
			{ endpointId: 'ep-1' },
			1,
			expect.objectContaining({ address: 7, scale: 1, offset: 0, invert: false }),
			99,
			{ byteOrder: ModbusByteOrder.LITTLE, wordOrder: ModbusByteOrder.BIG },
		);
		expect(response.data).toMatchObject({
			ok: false,
			error: { kind: 'exception', exception_code: 2, message: 'Illegal data address' },
			duration_ms: 6,
		});
	});
});
