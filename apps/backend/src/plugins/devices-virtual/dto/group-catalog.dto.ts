import { Expose } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

@ApiSchema({ name: 'DevicesVirtualPluginGroupCatalog' })
export class GroupCatalogDto {
	@ApiPropertyOptional({ enum: VirtualLightGroupProfile, default: VirtualLightGroupProfile.LIGHT })
	@Expose()
	@IsOptional()
	@IsEnum(VirtualLightGroupProfile)
	profile?: VirtualLightGroupProfile;
	@ApiPropertyOptional({ name: 'selected_channels', type: [String], format: 'uuid', maxItems: 256 })
	@Expose({ name: 'selected_channels' })
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(256)
	@IsUUID('4', { each: true })
	selectedChannels?: string[];
	@ApiPropertyOptional({ enum: PropertyCategory, isArray: true, maxItems: 8 })
	@Expose()
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@ArrayMaxSize(8)
	@IsEnum(PropertyCategory, { each: true })
	capabilities?: PropertyCategory[];
	@ApiPropertyOptional({
		name: 'exposed_group',
		format: 'uuid',
		description: 'Retain this group output contract when selecting repair candidates; never authorizes dispatch.',
	})
	@Expose({ name: 'exposed_group' })
	@IsOptional()
	@IsUUID('4')
	exposedGroup?: string;
}
