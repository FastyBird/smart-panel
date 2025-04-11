import { Expose } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

import { UpdatePageDto } from '../../../modules/dashboard/dto/update-page.dto';
import { ValidateDeviceExists } from '../../../modules/devices/validators/device-exists-constraint.validator';
import type { components } from '../../../openapi';

type UpdateDeviceDetailPage = components['schemas']['DashboardUpdateDeviceDetailPage'];

export class UpdateDeviceDetailPageDto extends UpdatePageDto implements UpdateDeviceDetailPage {
	readonly type: 'device-detail';

	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateDeviceExists({ message: '[{"field":"device","reason":"The specified device does not exist."}]' })
	device?: string;
}
