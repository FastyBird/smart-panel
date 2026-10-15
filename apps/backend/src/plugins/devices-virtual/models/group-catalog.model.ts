import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { VirtualLightGroupCapabilityModel } from './producer-response.model';

@ApiSchema({ name: 'DevicesVirtualPluginDataGroupProfile' })
export class GroupProfileModel {
	@ApiProperty({ enum: VirtualLightGroupProfile }) @Expose() profile: VirtualLightGroupProfile;
	@ApiProperty({ enum: DeviceCategory }) @Expose() device_category: DeviceCategory;
	@ApiProperty({ enum: ChannelCategory }) @Expose() channel_category: ChannelCategory;
	@ApiProperty({ enum: PropertyCategory, isArray: true }) @Expose() required_capabilities: PropertyCategory[];
}
@ApiSchema({ name: 'DevicesVirtualPluginDataGroupCandidate' })
export class GroupCandidateModel {
	@ApiProperty({ format: 'uuid' }) @Expose() channel: string;
	@ApiProperty({ format: 'uuid' }) @Expose() device: string;
	@ApiProperty() @Expose() name: string;
	@ApiProperty() @Expose() eligible: boolean;
	@ApiProperty({ type: [String] }) @Expose() reasons: string[];
	@ApiProperty({ type: [VirtualLightGroupCapabilityModel] })
	@Expose()
	@Type(() => VirtualLightGroupCapabilityModel)
	common_capabilities: VirtualLightGroupCapabilityModel[];
}
@ApiSchema({ name: 'DevicesVirtualPluginDataGroupCatalog' })
export class GroupCatalogModel {
	@ApiProperty({ type: [GroupProfileModel] }) @Expose() @Type(() => GroupProfileModel) profiles: GroupProfileModel[];
	@ApiProperty({ type: [GroupCandidateModel] })
	@Expose()
	@Type(() => GroupCandidateModel)
	candidates: GroupCandidateModel[];
	@ApiProperty({ type: [String] }) @Expose() diagnostics: string[];
}
@ApiSchema({ name: 'DevicesVirtualPluginResGroupCatalog' })
export class GroupCatalogResponseModel extends BaseSuccessResponseModel<GroupCatalogModel> {
	@ApiProperty({ type: GroupCatalogModel }) @Expose() @Type(() => GroupCatalogModel) declare data: GroupCatalogModel;
}
