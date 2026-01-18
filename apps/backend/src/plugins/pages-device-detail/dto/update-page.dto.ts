import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import { ValidateDeviceExists } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { PAGES_DEVICE_DETAIL_TYPE } from '../pages-device-detail.constants';

@ApiSchema({ name: 'PagesDeviceDetailPluginUpdateDeviceDetailPage' })
export class UpdateDeviceDetailPageDto extends UpdatePageDto {
	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_DEVICE_DETAIL_TYPE,
		example: PAGES_DEVICE_DETAIL_TYPE,
	})
	readonly type: typeof PAGES_DEVICE_DETAIL_TYPE;

	@ApiPropertyOptional({
		description: 'Device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@Transform(({ value }) => (value === null ? undefined : value))
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;
}
