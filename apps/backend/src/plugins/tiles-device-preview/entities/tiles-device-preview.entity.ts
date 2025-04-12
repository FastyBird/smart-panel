import { Exclude, Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Validate, ValidateIf } from 'class-validator';
import { ChildEntity, Column, ManyToOne, RelationId } from 'typeorm';

import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';

@ChildEntity()
export class DevicePreviewTileEntity extends TileEntity {
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
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE', eager: true })
	device: DeviceEntity | string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null = null;

	@Exclude({ toPlainOnly: true })
	@RelationId((tile: DevicePreviewTileEntity) => tile.device)
	deviceId: string;

	@Expose()
	get type(): string {
		return 'device-preview';
	}
}
