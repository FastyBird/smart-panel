import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { DisplayEntity } from '../entities/displays.entity';

@ApiSchema({ name: 'DisplaysModuleResDisplay' })
export class DisplayResponseModel {
	@ApiProperty({
		description: 'Indicates whether the API request was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		description: 'Display data',
		type: () => DisplayEntity,
	})
	@Expose()
	@Type(() => DisplayEntity)
	data: DisplayEntity;
}

@ApiSchema({ name: 'DisplaysModuleResDisplays' })
export class DisplaysResponseModel {
	@ApiProperty({
		description: 'Indicates whether the API request was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		description: 'List of displays',
		type: 'array',
		items: {
			$ref: getSchemaPath(DisplayEntity),
		},
	})
	@Expose()
	@Type(() => DisplayEntity)
	data: DisplayEntity[];
}

@ApiSchema({ name: 'DisplaysModuleDataRegistration' })
export class DisplayRegistrationDataModel {
	@ApiProperty({
		description: 'The registered display',
		type: () => DisplayEntity,
	})
	@Expose()
	@Type(() => DisplayEntity)
	display: DisplayEntity;

	@ApiProperty({
		description: 'Long-lived access token for the display',
		type: 'string',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
		name: 'access_token',
	})
	@Expose({ name: 'access_token' })
	accessToken: string;
}

@ApiSchema({ name: 'DisplaysModuleResDisplayRegistration' })
export class DisplayRegistrationResponseModel {
	@ApiProperty({
		description: 'Indicates whether the API request was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		description: 'Display registration data',
		type: () => DisplayRegistrationDataModel,
	})
	@Expose()
	@Type(() => DisplayRegistrationDataModel)
	data: DisplayRegistrationDataModel;
}
