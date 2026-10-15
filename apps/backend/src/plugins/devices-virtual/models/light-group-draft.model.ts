import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { VirtualDeviceEntity } from '../entities/devices-virtual.entity';

import { CoverOperationReadinessModel } from './producer-response.model';
import { VirtualLightGroupConfigurationModel } from './producer-response.model';
import { VirtualLightGroupCapabilityModel } from './producer-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupDraftMember' })
export class LightGroupDraftMemberModel {
	@ApiProperty({ format: 'uuid' })
	@Expose()
	source_channel: string;

	@ApiProperty({ format: 'uuid' })
	@Expose()
	device_id: string;

	@ApiProperty()
	@Expose()
	name: string;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataLightGroupDraft' })
export class LightGroupDraftModel {
	@ApiPropertyOptional({ type: [CoverOperationReadinessModel] })
	@Expose()
	@Type(() => CoverOperationReadinessModel)
	operations?: CoverOperationReadinessModel[];

	@ApiProperty()
	@Expose()
	graph_revision: number;

	@ApiProperty({ type: [VirtualLightGroupCapabilityModel] })
	@Expose()
	@Type(() => VirtualLightGroupCapabilityModel)
	common_capabilities: VirtualLightGroupCapabilityModel[];

	@ApiProperty({
		enum: PropertyCategory,
		isArray: true,
		description:
			'Optional controls omitted because not every intended member supports the same permission, datatype, unit, range/step or complete color tuple',
	})
	@Expose()
	unavailable_capabilities: PropertyCategory[];

	@ApiProperty({ type: [LightGroupDraftMemberModel] })
	@Expose()
	@Type(() => LightGroupDraftMemberModel)
	members: LightGroupDraftMemberModel[];
}

@ApiSchema({ name: 'DevicesVirtualPluginResLightGroupDraft' })
export class LightGroupDraftResponseModel extends BaseSuccessResponseModel<LightGroupDraftModel> {
	@ApiProperty({ type: LightGroupDraftModel })
	@Expose()
	@Type(() => LightGroupDraftModel)
	declare data: LightGroupDraftModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginDataCreatedLightGroup' })
export class CreatedLightGroupModel {
	@ApiProperty({ type: VirtualDeviceEntity })
	@Expose()
	@Type(() => VirtualDeviceEntity)
	device: VirtualDeviceEntity;

	@ApiProperty({ type: VirtualLightGroupConfigurationModel })
	@Expose()
	@Type(() => VirtualLightGroupConfigurationModel)
	configuration: VirtualLightGroupConfigurationModel;
}

@ApiSchema({ name: 'DevicesVirtualPluginResCreatedLightGroup' })
export class CreatedLightGroupResponseModel extends BaseSuccessResponseModel<CreatedLightGroupModel> {
	@ApiProperty({ type: CreatedLightGroupModel })
	@Expose()
	@Type(() => CreatedLightGroupModel)
	declare data: CreatedLightGroupModel;
}
