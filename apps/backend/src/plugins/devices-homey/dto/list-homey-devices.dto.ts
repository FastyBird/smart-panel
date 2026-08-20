import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export enum HomeyInventorySupportFilter {
	ALL = 'all',
	SUPPORTED = 'supported',
	UNSUPPORTED = 'unsupported',
	CONFLICTED = 'conflicted',
}

export enum HomeyInventoryAdoptionFilter {
	ALL = 'all',
	ADOPTED = 'adopted',
	NOT_ADOPTED = 'not_adopted',
}

export enum HomeyInventoryAvailabilityFilter {
	ALL = 'all',
	AVAILABLE = 'available',
	UNAVAILABLE = 'unavailable',
}

export class ListHomeyDevicesQueryDto {
	@ApiPropertyOptional({ description: 'Filter by mapping support state', enum: HomeyInventorySupportFilter })
	@Expose()
	@IsOptional()
	@IsEnum(HomeyInventorySupportFilter)
	support?: HomeyInventorySupportFilter;

	@ApiPropertyOptional({ description: 'Filter by Smart Panel adoption state', enum: HomeyInventoryAdoptionFilter })
	@Expose()
	@IsOptional()
	@IsEnum(HomeyInventoryAdoptionFilter)
	adoption?: HomeyInventoryAdoptionFilter;

	@ApiPropertyOptional({ description: 'Filter by Homey availability', enum: HomeyInventoryAvailabilityFilter })
	@Expose()
	@IsOptional()
	@IsEnum(HomeyInventoryAvailabilityFilter)
	availability?: HomeyInventoryAvailabilityFilter;

	@ApiPropertyOptional({ name: 'zone_id', description: 'Filter by exact Homey zone identifier', type: 'string' })
	@Expose({ name: 'zone_id' })
	@Transform(({ obj }: { obj: { zone_id?: string; zoneId?: string } }) => obj.zone_id ?? obj.zoneId, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	zoneId?: string;

	@ApiPropertyOptional({ name: 'class', description: 'Filter by exact normalized Homey device class', type: 'string' })
	@Expose({ name: 'class' })
	@Transform(({ obj }: { obj: { class?: string; deviceClass?: string } }) => obj.class ?? obj.deviceClass, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	deviceClass?: string;

	@ApiPropertyOptional({ description: 'Case-insensitive search over normalized device metadata', type: 'string' })
	@Expose()
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;
}
