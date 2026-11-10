import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_MODBUS_API_TAG_NAME, MODBUS_DEFAULTS } from '../devices-modbus.constants';
import { ModbusValidationException } from '../devices-modbus.exceptions';
import { ModbusBindingDto } from '../dto/binding.dto';
import {
	ProbeModbusReadDto,
	ReqProbeModbusPointsDto,
	ReqProbeModbusReadDto,
	ReqProbeModbusWriteDto,
} from '../dto/probe.dto';
import {
	ModbusProbePointsResponseModel,
	ModbusProbeReadResponseModel,
	ModbusProbeWriteResponseModel,
} from '../models/probe-response.model';
import { ModbusProbePointsModel, ModbusProbeReadModel, ModbusProbeWriteModel } from '../models/probe.model';
import { ModbusProbeBinding, ModbusProbeService, ModbusProbeTarget } from '../services/modbus-probe.service';

type TargetFields = Pick<
	ProbeModbusReadDto,
	'endpoint_id' | 'host' | 'port' | 'framing' | 'connect_timeout_ms' | 'request_timeout_ms'
>;

const TARGET_ERROR = 'Provide either endpoint_id or host, port and framing, not both.';

const targetError = (): ModbusValidationException =>
	new ModbusValidationException([JSON.stringify({ field: 'endpoint_id', reason: TARGET_ERROR })]);

/** Exactly one of the two target forms: a saved endpoint, or complete unsaved connection details. */
function toTarget(dto: TargetFields): ModbusProbeTarget {
	const hasDetails = [dto.host, dto.port, dto.framing, dto.connect_timeout_ms, dto.request_timeout_ms].some(
		(value) => value !== undefined,
	);

	if (dto.endpoint_id !== undefined) {
		if (hasDetails) {
			throw targetError();
		}

		return { endpointId: dto.endpoint_id };
	}

	if (dto.host === undefined || dto.port === undefined || dto.framing === undefined) {
		throw targetError();
	}

	return {
		host: dto.host,
		port: dto.port,
		framing: dto.framing,
		connectTimeoutMs: dto.connect_timeout_ms,
		requestTimeoutMs: dto.request_timeout_ms,
	};
}

function toBinding(dto: ModbusBindingDto): ModbusProbeBinding {
	return {
		registerType: dto.register_type,
		address: dto.address,
		dataType: dto.data_type,
		bit: dto.bit ?? null,
		byteOrder: dto.byte_order ?? null,
		wordOrder: dto.word_order ?? null,
		scale: dto.scale ?? 1,
		offset: dto.offset ?? 0,
		invert: dto.invert ?? false,
		valueMap: dto.value_map?.map(({ raw, value }) => ({ raw, value })) ?? null,
		writeFunction: dto.write_function ?? null,
	};
}

@ApiTags(DEVICES_MODBUS_API_TAG_NAME)
@Controller('probe')
export class ModbusProbeController {
	constructor(private readonly probe: ModbusProbeService) {}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Read raw Modbus registers or bits',
		description:
			'Reads one range of registers or bits from a saved endpoint or from unsaved connection details. A device or connection failure is reported in the result, not as an HTTP error. Nothing is stored.',
		operationId: 'create-devices-modbus-plugin-probe-read',
	})
	@ApiBody({ type: ReqProbeModbusReadDto, description: 'The target and the range to read' })
	@ApiSuccessResponse(ModbusProbeReadResponseModel, 'The probe ran; the result says whether the device answered.')
	@ApiBadRequestResponse('Invalid request data, an invalid target or a range outside the protocol limits')
	@ApiNotFoundResponse('Endpoint not found')
	@ApiTooManyRequestsResponse({ description: 'Too many probes, or another probe to this endpoint is still running' })
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Throttle({ default: { limit: 60, ttl: 60000 } })
	@Post('read')
	@HttpCode(200)
	async read(@Body() body: ReqProbeModbusReadDto): Promise<ModbusProbeReadResponseModel> {
		const { data } = body;
		const result = await this.probe.read(toTarget(data), {
			unitId: data.unit_id,
			registerType: data.register_type,
			address: data.address,
			count: data.count,
		});
		const response = new ModbusProbeReadResponseModel();

		response.data = ModbusProbeReadModel.from(result);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Read and decode Modbus points',
		description:
			'Reads a set of bindings in as few requests as the limits allow and decodes each one. A device or connection failure is reported per point and for the whole probe in the result, not as an HTTP error. Nothing is stored.',
		operationId: 'create-devices-modbus-plugin-probe-points',
	})
	@ApiBody({ type: ReqProbeModbusPointsDto, description: 'The target, the read limits and the points to read' })
	@ApiSuccessResponse(ModbusProbePointsResponseModel, 'The probe ran; the result carries every point.')
	@ApiBadRequestResponse('Invalid request data, an invalid target or a point outside the address space')
	@ApiNotFoundResponse('Endpoint not found')
	@ApiTooManyRequestsResponse({ description: 'Too many probes, or another probe to this endpoint is still running' })
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Throttle({ default: { limit: 60, ttl: 60000 } })
	@Post('points')
	@HttpCode(200)
	async points(@Body() body: ReqProbeModbusPointsDto): Promise<ModbusProbePointsResponseModel> {
		const { data } = body;
		const result = await this.probe.readPoints(
			toTarget(data),
			data.points.map(({ key, binding }) => ({ key, binding: toBinding(binding) })),
			{
				unitId: data.unit_id,
				byteOrder: data.byte_order ?? MODBUS_DEFAULTS.BYTE_ORDER,
				wordOrder: data.word_order ?? MODBUS_DEFAULTS.WORD_ORDER,
				limits: {
					maxRegisters: data.max_read_registers ?? MODBUS_DEFAULTS.MAX_READ_REGISTERS,
					maxBits: data.max_read_bits ?? MODBUS_DEFAULTS.MAX_READ_BITS,
					maxGap: data.max_read_gap ?? MODBUS_DEFAULTS.MAX_READ_GAP,
				},
			},
		);
		const response = new ModbusProbePointsResponseModel();

		response.data = ModbusProbePointsModel.from(result);

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_MODBUS_API_TAG_NAME],
		summary: 'Write a test value to a Modbus coil or holding register',
		description:
			'Encodes a value through the binding and writes it to the device. This changes the device; call it only when the user explicitly asks for that specific write. A device or connection failure is reported in the result, not as an HTTP error.',
		operationId: 'create-devices-modbus-plugin-probe-write',
	})
	@ApiBody({ type: ReqProbeModbusWriteDto, description: 'The target, the binding and the value to write' })
	@ApiSuccessResponse(
		ModbusProbeWriteResponseModel,
		'The probe ran; the result says whether the device accepted the write.',
	)
	@ApiBadRequestResponse('Invalid request data, an invalid target or a binding that cannot be written')
	@ApiNotFoundResponse('Endpoint not found')
	@ApiTooManyRequestsResponse({ description: 'Too many probes, or another probe to this endpoint is still running' })
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@Post('write')
	@HttpCode(200)
	async write(@Body() body: ReqProbeModbusWriteDto): Promise<ModbusProbeWriteResponseModel> {
		const { data } = body;
		const result = await this.probe.write(toTarget(data), data.unit_id, toBinding(data.binding), data.value, {
			byteOrder: data.byte_order ?? MODBUS_DEFAULTS.BYTE_ORDER,
			wordOrder: data.word_order ?? MODBUS_DEFAULTS.WORD_ORDER,
		});
		const response = new ModbusProbeWriteResponseModel();

		response.data = ModbusProbeWriteModel.from(result);

		return response;
	}
}
