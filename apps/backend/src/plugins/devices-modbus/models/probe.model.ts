import { Expose, Type, plainToInstance } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import {
	ModbusProbeError,
	ModbusProbeErrorKind,
	ModbusProbePointResult,
	ModbusProbePointsResult,
	ModbusProbeReadResult,
	ModbusProbeWriteResult,
} from '../services/modbus-probe.service';

const ERROR_KINDS: ModbusProbeErrorKind[] = ['timeout', 'connection', 'unavailable', 'exception', 'encode'];

const RAW_ITEMS = { oneOf: [{ type: 'number' }, { type: 'boolean' }] };

const toErrorPlain = (error: ModbusProbeError | null) =>
	error ? { kind: error.kind, exception_code: error.exceptionCode, message: error.message } : null;

@ApiSchema({ name: 'DevicesModbusPluginDataProbeError' })
export class ModbusProbeErrorModel {
	@ApiProperty({ description: 'What went wrong', enum: ERROR_KINDS, example: 'exception' })
	@Expose()
	kind: ModbusProbeErrorKind;

	@ApiProperty({
		name: 'exception_code',
		description: 'Modbus exception code returned by the device; null for other kinds',
		type: 'integer',
		nullable: true,
		example: 2,
	})
	@Expose()
	exception_code: number | null;

	@ApiProperty({ description: 'Human-readable description', type: 'string', example: 'Illegal data address' })
	@Expose()
	message: string;
}

@ApiSchema({ name: 'DevicesModbusPluginDataProbeRead' })
export class ModbusProbeReadModel {
	@ApiProperty({ description: 'Whether the read succeeded', type: 'boolean', example: true })
	@Expose()
	ok: boolean;

	@ApiProperty({
		description: 'Raw registers (numbers) or bits (booleans) read; null when the read failed',
		type: 'array',
		items: RAW_ITEMS,
		nullable: true,
		example: [10, 11, 12],
	})
	@Expose()
	values: (number | boolean)[] | null;

	@ApiProperty({
		description: 'Why the read failed; null on success',
		type: () => ModbusProbeErrorModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ModbusProbeErrorModel)
	error: ModbusProbeErrorModel | null;

	@ApiProperty({
		name: 'duration_ms',
		description: 'Time the probe took in milliseconds',
		type: 'number',
		example: 12.5,
	})
	@Expose()
	duration_ms: number;

	static from(result: ModbusProbeReadResult): ModbusProbeReadModel {
		return plainToInstance(ModbusProbeReadModel, {
			ok: result.ok,
			values: result.values,
			error: toErrorPlain(result.error),
			duration_ms: result.durationMs,
		});
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataProbePoint' })
export class ModbusProbePointModel {
	@ApiProperty({ description: 'Key of the requested point', type: 'string', example: 'di_1' })
	@Expose()
	key: string;

	@ApiProperty({
		description: 'Raw registers or bits behind the point; null when its read failed',
		type: 'array',
		items: RAW_ITEMS,
		nullable: true,
		example: [10],
	})
	@Expose()
	raw: (number | boolean)[] | null;

	@ApiProperty({
		description: 'Decoded property value; null when the point could not be read or decoded',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		nullable: true,
		example: 1.2,
	})
	@Expose()
	value: string | number | boolean | null;

	@ApiProperty({
		description: 'Why the point failed; null on success',
		type: () => ModbusProbeErrorModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ModbusProbeErrorModel)
	error: ModbusProbeErrorModel | null;

	static fromResult(result: ModbusProbePointResult): Record<string, unknown> {
		return { key: result.key, raw: result.raw, value: result.value, error: toErrorPlain(result.error) };
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataProbePoints' })
export class ModbusProbePointsModel {
	@ApiProperty({ description: 'Whether at least one point was read', type: 'boolean', example: true })
	@Expose()
	ok: boolean;

	@ApiProperty({
		description: 'Result of every requested point, in request order',
		type: () => [ModbusProbePointModel],
	})
	@Expose()
	@Type(() => ModbusProbePointModel)
	points: ModbusProbePointModel[];

	@ApiProperty({
		description: 'Failure that affected the whole probe (for example a connection failure); null otherwise',
		type: () => ModbusProbeErrorModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ModbusProbeErrorModel)
	error: ModbusProbeErrorModel | null;

	@ApiProperty({
		name: 'duration_ms',
		description: 'Time the probe took in milliseconds',
		type: 'number',
		example: 25.1,
	})
	@Expose()
	duration_ms: number;

	static from(result: ModbusProbePointsResult): ModbusProbePointsModel {
		return plainToInstance(ModbusProbePointsModel, {
			ok: result.ok,
			points: result.points.map((point) => ModbusProbePointModel.fromResult(point)),
			error: toErrorPlain(result.error),
			duration_ms: result.durationMs,
		});
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataProbeWrite' })
export class ModbusProbeWriteModel {
	@ApiProperty({ description: 'Whether the device accepted the write', type: 'boolean', example: true })
	@Expose()
	ok: boolean;

	@ApiProperty({
		description: 'Why the write failed; null on success',
		type: () => ModbusProbeErrorModel,
		nullable: true,
	})
	@Expose()
	@Type(() => ModbusProbeErrorModel)
	error: ModbusProbeErrorModel | null;

	@ApiProperty({
		name: 'duration_ms',
		description: 'Time the probe took in milliseconds',
		type: 'number',
		example: 9.8,
	})
	@Expose()
	duration_ms: number;

	static from(result: ModbusProbeWriteResult): ModbusProbeWriteModel {
		return plainToInstance(ModbusProbeWriteModel, {
			ok: result.ok,
			error: toErrorPlain(result.error),
			duration_ms: result.durationMs,
		});
	}
}
