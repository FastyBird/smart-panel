import { Expose } from 'class-transformer';
import { IsUUID } from 'class-validator';

import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { ValidateDeviceExists } from '../../../modules/devices/validators/device-exists-constraint.validator';
import type { components } from '../../../openapi';

type CreateDeviceDetailPage = components['schemas']['PagesDeviceDetailPluginCreateDeviceDetailPage'];

export class CreateDeviceDetailPageDto extends CreatePageDto implements CreateDeviceDetailPage {
	readonly type: 'device-detail';

	@Expose()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device: string;
}
