import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { HomeyTestConnectionMode } from '../dto/test-connection.dto';
import { HomeyConnectorErrorCategory } from '../errors/homey-connector.error';

@ApiSchema({ name: 'DevicesHomeyPluginDataTestConnection' })
export class HomeyTestConnectionModel {
	@ApiProperty({ description: 'Connection test mode that was evaluated', enum: HomeyTestConnectionMode })
	@Expose()
	@IsEnum(HomeyTestConnectionMode)
	mode: HomeyTestConnectionMode;

	@ApiProperty({ description: 'Whether authentication and the Homey system-info read succeeded' })
	@Expose()
	@IsBoolean()
	success: boolean;

	@ApiPropertyOptional({ description: 'Connected Homey identifier', nullable: true, name: 'homey_id' })
	@Expose({ name: 'homey_id' })
	@IsOptional()
	@IsString()
	homeyId: string | null;

	@ApiPropertyOptional({ description: 'Connected Homey display name', nullable: true, name: 'homey_name' })
	@Expose({ name: 'homey_name' })
	@IsOptional()
	@IsString()
	homeyName: string | null;

	@ApiPropertyOptional({ description: 'Connected Homey software version', nullable: true, name: 'homey_version' })
	@Expose({ name: 'homey_version' })
	@IsOptional()
	@IsString()
	homeyVersion: string | null;

	@ApiPropertyOptional({
		description: 'Normalized connection failure category',
		enum: HomeyConnectorErrorCategory,
		nullable: true,
		name: 'error_category',
	})
	@Expose({ name: 'error_category' })
	@IsOptional()
	@IsEnum(HomeyConnectorErrorCategory)
	errorCategory: HomeyConnectorErrorCategory | null;

	@ApiPropertyOptional({ description: 'Fixed credential-safe connection failure summary', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	error: string | null;
}

@ApiSchema({ name: 'DevicesHomeyPluginResTestConnection' })
export class HomeyTestConnectionResponseModel extends BaseSuccessResponseModel<HomeyTestConnectionModel> {
	@ApiProperty({ type: HomeyTestConnectionModel })
	@Expose()
	declare data: HomeyTestConnectionModel;
}
