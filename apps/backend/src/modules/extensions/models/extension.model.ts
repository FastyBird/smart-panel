import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ExtensionKind } from '../extensions.constants';

@ApiSchema({ name: 'ExtensionsModuleExtensionLinks' })
export class ExtensionLinksModel {
	@ApiPropertyOptional({
		description: 'URL to extension documentation',
		type: 'string',
		example: 'https://docs.example.com',
	})
	@Expose()
	@IsString()
	@IsOptional()
	documentation?: string;

	@ApiPropertyOptional({
		description: 'URL to developer documentation',
		type: 'string',
		example: 'https://dev.example.com',
	})
	@Expose({ name: 'dev_documentation' })
	@IsString()
	@IsOptional()
	devDocumentation?: string;

	@ApiPropertyOptional({
		description: 'URL to bug tracking system',
		type: 'string',
		example: 'https://github.com/example/issues',
	})
	@Expose({ name: 'bugs_tracking' })
	@IsString()
	@IsOptional()
	bugsTracking?: string;

	@ApiPropertyOptional({
		description: 'URL to source code repository',
		type: 'string',
		example: 'https://github.com/example/repo',
	})
	@Expose()
	@IsString()
	@IsOptional()
	repository?: string;

	@ApiPropertyOptional({
		description: 'URL to extension homepage',
		type: 'string',
		example: 'https://example.com',
	})
	@Expose()
	@IsString()
	@IsOptional()
	homepage?: string;
}

@ApiSchema({ name: 'ExtensionsModuleExtension' })
export class ExtensionModel {
	@ApiProperty({
		description: 'Extension type identifier',
		type: 'string',
		example: 'devices-shelly-ng-plugin',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Extension kind (module or plugin)',
		enum: ExtensionKind,
		example: ExtensionKind.PLUGIN,
	})
	@Expose()
	@IsEnum(ExtensionKind)
	kind: ExtensionKind;

	@ApiProperty({
		description: 'Extension display name',
		type: 'string',
		example: 'Shelly NG Devices',
	})
	@Expose()
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'Extension description',
		type: 'string',
		example: 'Integration for Shelly Next Generation devices',
	})
	@Expose()
	@IsString()
	@IsOptional()
	description?: string;

	@ApiPropertyOptional({
		description: 'Extension version',
		type: 'string',
		example: '1.0.0',
	})
	@Expose()
	@IsString()
	@IsOptional()
	version?: string;

	@ApiPropertyOptional({
		description: 'Extension author',
		type: 'string',
		example: 'FastyBird',
	})
	@Expose()
	@IsString()
	@IsOptional()
	author?: string;

	@ApiProperty({
		description: 'Whether the extension is enabled',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({
		description: 'Whether the extension is a core extension (cannot be disabled)',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'is_core' })
	@IsBoolean()
	isCore: boolean;

	@ApiPropertyOptional({
		description: 'Extension links',
		type: () => ExtensionLinksModel,
	})
	@Expose()
	@IsOptional()
	links?: ExtensionLinksModel;
}
