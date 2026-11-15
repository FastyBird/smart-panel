import { Expose, Transform, Type } from 'class-transformer';
import { IsDefined, IsInt, IsObject, IsOptional, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PROTECT_PROBE_DEFAULT_PORT } from '../services/protect-discovery.constants';
import { IsProtectProbeHost } from '../validators/protect-probe-host.validator';

@ApiSchema({ name: 'DevicesUnifiProtectPluginProbe' })
export class ProtectProbeDto {
	@ApiProperty({ description: 'Console host name or IP address to probe', example: '192.168.1.10' })
	@Expose()
	// Reads the original plain value: implicit conversion has already turned `true` into 'true' by the time `value`
	// arrives. Trims and lowercases strings only; any other value reaches the validator unchanged.
	@Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
		const original = obj[key];

		return typeof original === 'string' ? original.trim().toLowerCase() : original;
	})
	@IsProtectProbeHost({
		message: '[{"field":"host","reason":"Host must be an IP address or host name without scheme, path or port."}]',
	})
	host: string;

	@ApiPropertyOptional({
		description: 'Console HTTPS port',
		example: PROTECT_PROBE_DEFAULT_PORT,
		minimum: 1,
		maximum: 65535,
	})
	@Expose()
	// Reads the original plain value: implicit conversion has already turned `true` into 1 and '443' into 443 by the
	// time `value` arrives, so only a JSON integer may reach the validators.
	@Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key])
	@IsOptional()
	@IsInt({ message: '[{"field":"port","reason":"Port must be a whole number."}]' })
	@Min(1, { message: '[{"field":"port","reason":"Port must be between 1 and 65535."}]' })
	@Max(65535, { message: '[{"field":"port","reason":"Port must be between 1 and 65535."}]' })
	port?: number;
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginReqProbe' })
export class ProtectProbeRequestDto {
	@ApiProperty({ description: 'Host to probe', type: () => ProtectProbeDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Probe data is required."}]' })
	@IsObject({ message: '[{"field":"data","reason":"Probe data must be an object."}]' })
	@ValidateNested()
	@Type(() => ProtectProbeDto)
	data: ProtectProbeDto;
}
