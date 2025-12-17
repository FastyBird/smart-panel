import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';
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
