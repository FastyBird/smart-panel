import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsNotEmptyObject, IsObject, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'ExtensionsModuleUpdateExtensionData' })
export class UpdateExtensionDataDto {
	@ApiProperty({
		description: 'Enable or disable the extension',
		type: 'boolean',
		example: true,
	})
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { enabled?: unknown } }) => obj.enabled, { toClassOnly: true })
	@IsDefined()
	@IsBoolean()
	enabled: boolean;
}

@ApiSchema({ name: 'ExtensionsModuleReqUpdateExtension' })
export class ReqUpdateExtensionDto {
	@ApiProperty({
		description: 'Extension update data',
		type: () => UpdateExtensionDataDto,
	})
	@Expose()
	@IsDefined()
	@IsNotEmptyObject()
	@IsObject()
	@ValidateNested()
	@Type(() => UpdateExtensionDataDto)
	data: UpdateExtensionDataDto;
}
