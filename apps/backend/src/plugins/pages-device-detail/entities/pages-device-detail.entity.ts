import { Exclude, Expose, Transform } from 'class-transformer';
import { IsUUID, Validate, ValidateIf } from 'class-validator';
import { ChildEntity, ManyToOne, RelationId } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PAGES_DEVICE_DETAIL_TYPE } from '../pages-device-detail.constants';

@ApiSchema({ name: 'PagesDeviceDetailPluginDataDeviceDetailPage' })
@ChildEntity()
export class DeviceDetailPageEntity extends PageEntity {
	@ApiProperty({
		description: 'Device identifier',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;

	@Exclude({ toPlainOnly: true })
	@RelationId((tile: DeviceDetailPageEntity) => tile.device)
	deviceId: string;

	@ApiProperty({
		description: 'Page type',
		type: 'string',
		default: PAGES_DEVICE_DETAIL_TYPE,
		example: PAGES_DEVICE_DETAIL_TYPE,
	})
	@Expose()
	get type(): string {
		return PAGES_DEVICE_DETAIL_TYPE;
	}
}
