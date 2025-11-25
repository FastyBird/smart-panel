import { Expose } from 'class-transformer';
import { IsUUID } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { ValidateDeviceExists } from '../../../modules/devices/validators/device-exists-constraint.validator';
import type { components } from '../../../openapi';
import { PAGES_DEVICE_DETAIL_TYPE } from '../pages-device-detail.constants';

type CreateDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginCreateDeviceDetailPage'];

@ApiSchema({ name: 'PagesDeviceDetailPluginCreateDeviceDetailPage' })
export class CreateDeviceDetailPageDto extends CreatePageDto implements CreateDeviceDetailPage {
	readonly type: typeof PAGES_DEVICE_DETAIL_TYPE;

	@ApiProperty({
		description: 'Device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;
}
