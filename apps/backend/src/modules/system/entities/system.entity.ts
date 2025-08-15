import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsString, IsUUID } from 'class-validator';
import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('system_module_displays_profiles')
export class DisplayProfileEntity extends BaseEntity {
	@Expose()
	@IsString()
	@IsUUID()
	@Column({ type: 'uuid' })
	uid: string;

	@Expose({ name: 'screen_width' })
	@IsInt()
	@Column({ type: 'int' })
	screenWidth: number;

	@Expose({ name: 'screen_height' })
	@IsInt()
	@Column({ type: 'int' })
	screenHeight: number;

	@Expose({ name: 'pixel_ratio' })
	@IsNumber()
	@Column({ type: 'float' })
	pixelRatio: number;

	@Expose({ name: 'unit_size' })
	@IsNumber()
	@Column({ type: 'float' })
	unitSize: number;

	@Expose()
	@IsNumber()
	@Column({ type: 'int' })
	rows: number;

	@Expose()
	@IsNumber()
	@Column({ type: 'int' })
	cols: number;

	@Expose()
	@IsBoolean()
	@Column({ type: 'boolean', default: false })
	primary: boolean;
}
