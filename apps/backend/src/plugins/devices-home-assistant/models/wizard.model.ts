import { Expose, Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { DeviceCategory } from '../../../modules/devices/devices.constants';

export const HOME_ASSISTANT_WIZARD_CANDIDATE_STATUSES = [
	'ready',
	'needs_attention',
	'already_registered',
	'failed',
] as const;

export type HomeAssistantWizardCandidateStatus = (typeof HOME_ASSISTANT_WIZARD_CANDIDATE_STATUSES)[number];

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataWizardCandidate' })
export class HomeAssistantWizardCandidateModel {
	@ApiProperty({ description: 'Stable candidate key for this session', example: 'device:abcd1234' })
	@Expose()
	@IsString()
	key: string;

	@ApiProperty({ description: 'Home Assistant candidate kind', enum: ['device', 'helper'], example: 'device' })
	@Expose()
	@IsIn(['device', 'helper'])
	kind: 'device' | 'helper';

	@ApiProperty({ description: 'Home Assistant device or entity identifier', example: 'abcd1234' })
	@Expose()
	@IsString()
	sourceId: string;

	@ApiProperty({ description: 'Suggested device name', example: 'Living room lamp' })
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({ description: 'Manufacturer', nullable: true, example: 'Philips' })
	@Expose()
	@IsOptional()
	@IsString()
	manufacturer: string | null;

	@ApiPropertyOptional({ description: 'Model or helper domain', nullable: true, example: 'Hue bulb' })
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null;

	@ApiProperty({ description: 'Automatic adoption status', enum: HOME_ASSISTANT_WIZARD_CANDIDATE_STATUSES })
	@Expose()
	@IsIn(HOME_ASSISTANT_WIZARD_CANDIDATE_STATUSES)
	status: HomeAssistantWizardCandidateStatus;

	@ApiPropertyOptional({ description: 'Automatically suggested category', enum: DeviceCategory, nullable: true })
	@Expose()
	@IsOptional()
	@IsEnum(DeviceCategory)
	suggestedCategory: DeviceCategory | null;

	@ApiProperty({ description: 'Number of channels in the automatic mapping', example: 2 })
	@Expose()
	@IsInt()
	previewChannelCount: number;

	@ApiProperty({ description: 'Number of mapping warnings requiring manual review', example: 0 })
	@Expose()
	@IsInt()
	warningCount: number;

	@ApiPropertyOptional({ description: 'Existing Smart Panel device identifier', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	adoptedDeviceId: string | null;

	@ApiPropertyOptional({ description: 'Discovery or mapping failure', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	error: string | null;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataWizardSession' })
export class HomeAssistantWizardSessionModel {
	@ApiProperty({ description: 'Wizard session id' })
	@Expose()
	@IsString()
	id: string;

	@ApiProperty({ description: 'Wizard session start timestamp' })
	@Expose()
	@IsString()
	startedAt: string;

	@ApiProperty({
		description: 'Home Assistant device and helper adoption candidates',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantWizardCandidateModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantWizardCandidateModel)
	candidates: HomeAssistantWizardCandidateModel[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataWizardAdoptionResult' })
export class HomeAssistantWizardAdoptionResultModel {
	@ApiProperty({ description: 'Candidate key from the wizard session' })
	@Expose()
	@IsString()
	key: string;

	@ApiProperty({ description: 'Resolved Smart Panel device name' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Adoption outcome', enum: ['created', 'failed'] })
	@Expose()
	@IsIn(['created', 'failed'])
	status: 'created' | 'failed';

	@ApiPropertyOptional({ description: 'Failure message', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	error: string | null;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginDataWizardAdoption' })
export class HomeAssistantWizardAdoptionModel {
	@ApiProperty({
		description: 'Per-candidate adoption results',
		type: 'array',
		items: { $ref: getSchemaPath(HomeAssistantWizardAdoptionResultModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => HomeAssistantWizardAdoptionResultModel)
	results: HomeAssistantWizardAdoptionResultModel[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginResWizardSession' })
export class HomeAssistantWizardSessionResponseModel extends BaseSuccessResponseModel<HomeAssistantWizardSessionModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => HomeAssistantWizardSessionModel,
	})
	@Expose()
	declare data: HomeAssistantWizardSessionModel;
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginResWizardAdoption' })
export class HomeAssistantWizardAdoptionResponseModel extends BaseSuccessResponseModel<HomeAssistantWizardAdoptionModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => HomeAssistantWizardAdoptionModel,
	})
	@Expose()
	declare data: HomeAssistantWizardAdoptionModel;
}
