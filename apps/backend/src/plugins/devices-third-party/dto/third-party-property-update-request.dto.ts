import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import type { components } from '../../../openapi';

type ThirdPartyDevicePropertyUpdateRequest = components['schemas']['DevicesThirdPartyPluginPropertyUpdateRequest'];
type ThirdPartyDevicePropertiesUpdateRequest = components['schemas']['DevicesThirdPartyPluginPropertiesUpdateRequest'];

export class PropertyUpdateRequestDto implements ThirdPartyDevicePropertyUpdateRequest {
	@Expose()
	@IsUUID()
	device: string;

	@Expose()
	@IsUUID()
	channel: string;

	@Expose()
	@IsUUID()
	property: string;

	@Expose()
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'string')
	@IsString()
	@IsNotEmpty({ message: '[{"field":"value","reason":"String value cannot be empty."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'boolean')
	@IsBoolean({ message: '[{"field":"value","reason":"Value must be a boolean."}]' })
	@ValidateIf((o: { value: unknown }) => typeof o.value === 'number')
	@IsNumber({}, { message: '[{"field":"value","reason":"Value must be a number."}]' })
	value: string | boolean | number;
}

export class PropertiesUpdateRequestDto implements ThirdPartyDevicePropertiesUpdateRequest {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PropertyUpdateRequestDto)
	properties: PropertyUpdateRequestDto[];
}
