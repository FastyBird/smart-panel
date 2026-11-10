import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MODBUS_DEFAULTS, MODBUS_LIMITS } from '../devices-modbus.constants';

@ApiSchema({ name: 'DevicesModbusPluginPreviewTemplate' })
export class PreviewModbusTemplateDto {
	@ApiPropertyOptional({
		name: 'unit_id',
		description: 'Modbus unit (slave) ID; the template default applies when omitted',
		type: 'integer',
		example: MODBUS_DEFAULTS.UNIT_ID,
		minimum: 0,
		maximum: 255,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"unit_id","reason":"Value must be an integer."}]' })
	@Min(0, { message: '[{"field":"unit_id","reason":"Value must be at least 0."}]' })
	@Max(255, { message: '[{"field":"unit_id","reason":"Value must be at most 255."}]' })
	unit_id?: number;

	@ApiPropertyOptional({
		name: 'poll_interval_ms',
		description: 'Poll interval in milliseconds; the template default applies when omitted',
		type: 'integer',
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
		minimum: MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS,
		maximum: MODBUS_LIMITS.MAX_POLL_INTERVAL_MS,
	})
	@Expose()
	@IsOptional()
	@IsInt({ message: '[{"field":"poll_interval_ms","reason":"Value must be an integer."}]' })
	@Min(MODBUS_DEFAULTS.MIN_POLL_INTERVAL_MS, {
		message: '[{"field":"poll_interval_ms","reason":"Poll interval must be at least 100 ms."}]',
	})
	@Max(MODBUS_LIMITS.MAX_POLL_INTERVAL_MS, {
		message: '[{"field":"poll_interval_ms","reason":"Poll interval must be at most 86400000 ms (one day)."}]',
	})
	poll_interval_ms?: number;
}

@ApiSchema({ name: 'DevicesModbusPluginReqPreviewTemplate' })
export class ReqPreviewModbusTemplateDto {
	@ApiProperty({ description: 'Template preview data', type: () => PreviewModbusTemplateDto })
	@Expose()
	@ValidateNested()
	@Type(() => PreviewModbusTemplateDto)
	data: PreviewModbusTemplateDto;
}
