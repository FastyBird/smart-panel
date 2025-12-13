import { Expose, Type } from 'class-transformer';
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
