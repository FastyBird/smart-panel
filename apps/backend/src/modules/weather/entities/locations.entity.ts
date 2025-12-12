import { Expose } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';
import { Column, Entity, TableInheritance } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';

@ApiSchema({ name: 'WeatherModuleDataLocation' })
@Entity('weather_module_locations')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class WeatherLocationEntity extends BaseEntity {
	@ApiProperty({
		description: 'Location name',
		type: 'string',
		example: 'Home',
	})
	@Expose()
	@IsString()
	@Column()
	name: string;

	@ApiProperty({
		description: 'Display order (lower numbers appear first)',
		type: 'integer',
		example: 0,
		default: 0,
	})
	@Expose()
	@IsInt()
	@Min(0)
	@Column({ type: 'int', default: 0 })
	order: number = 0;

	@ApiProperty({
		description: 'Location type (weather provider)',
		type: 'string',
		example: 'weather-openweathermap',
	})
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}
