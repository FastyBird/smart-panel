import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsString, IsUUID } from 'class-validator';
import { Column, Entity } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';

@ApiSchema({ name: 'SystemModuleDataDisplayProfile' })
@Entity('system_module_displays_profiles')
export class DisplayProfileEntity extends BaseEntity {
	@ApiProperty({
		description: 'Display profile unique identifier (UUID v4)',
		format: 'uuid',
		example: 'a1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	@IsString()
	@IsUUID()
	@Column({ type: 'uuid' })
	uid: string;

	@ApiProperty({
		name: 'screen_width',
		description: 'Display screen width in pixels',
		type: 'integer',
		example: 1920,
	})
	@Expose({ name: 'screen_width' })
	@IsInt()
	@Column({ type: 'int' })
	screenWidth: number;

	@ApiProperty({
		name: 'screen_height',
		description: 'Display screen height in pixels',
		type: 'integer',
		example: 1080,
	})
	@Expose({ name: 'screen_height' })
	@IsInt()
	@Column({ type: 'int' })
	screenHeight: number;

	@ApiProperty({
		name: 'pixel_ratio',
		description: 'Display pixel ratio',
		type: 'number',
		example: 1.5,
	})
	@Expose({ name: 'pixel_ratio' })
	@IsNumber()
	@Column({ type: 'float' })
	pixelRatio: number;

	@ApiProperty({
		name: 'unit_size',
		description: 'Display unit size',
		type: 'number',
		example: 8,
	})
	@Expose({ name: 'unit_size' })
	@IsNumber()
	@Column({ type: 'float' })
	unitSize: number;

	@ApiProperty({
		description: 'Number of rows',
		type: 'integer',
		example: 12,
	})
	@Expose()
	@IsNumber()
	@Column({ type: 'int' })
	rows: number;

	@ApiProperty({
		description: 'Number of columns',
		type: 'integer',
		example: 24,
	})
	@Expose()
	@IsNumber()
	@Column({ type: 'int' })
	cols: number;

	@ApiProperty({
		description: 'Whether this is the primary display profile',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	@Column({ type: 'boolean', default: false })
	primary: boolean;
}
