import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ExtensionKind, ExtensionSource, ExtensionSurface } from '../extensions.constants';

@ApiSchema({ name: 'ExtensionsModuleDataDiscoveredExtensionBase' })
export abstract class DiscoveredExtensionBaseModel {
	@ApiProperty({ description: 'Extension name', type: 'string', example: 'my-extension' })
	@Expose()
	@IsString()
	name: string;

	@ApiProperty({ description: 'Extension kind', enum: ExtensionKind })
	@Expose()
	@IsEnum(ExtensionKind)
	kind: ExtensionKind;

	@ApiProperty({ description: 'Extension surface', enum: ExtensionSurface })
	@Expose()
	@IsEnum(ExtensionSurface)
	surface: ExtensionSurface;

	@ApiProperty({ name: 'display_name', description: 'Display name', type: 'string', example: 'My Extension' })
	@Expose({ name: 'display_name' })
	@IsString()
	displayName: string;

	@ApiPropertyOptional({
		description: 'Extension description',
		type: 'string',
		nullable: true,
		example: 'A useful extension',
	})
	@Expose()
	@IsString()
	@IsOptional()
	description?: string | null = null;

	@ApiPropertyOptional({ description: 'Extension version', type: 'string', nullable: true, example: '1.0.0' })
	@Expose()
	@IsString()
	@IsOptional()
	version?: string | null = null;

	@ApiProperty({ description: 'Extension source', enum: ExtensionSource })
	@Expose()
	@IsEnum(ExtensionSource)
	source: ExtensionSource;
}

@ApiSchema({ name: 'ExtensionsModuleDataDiscoveredExtensionAdmin' })
export class DiscoveredExtensionAdminModel extends DiscoveredExtensionBaseModel {
	@ApiProperty({ name: 'remote_url', description: 'Remote URL', type: 'string', format: 'uri' })
	@Expose({ name: 'remote_url' })
	@IsString()
	remoteUrl: string;

	@ApiProperty({ description: 'Extension type', type: 'string', example: 'admin' })
	@Expose()
	@IsString()
	type: string = 'admin';
}

@ApiSchema({ name: 'ExtensionsModuleDataDiscoveredExtensionBackend' })
export class DiscoveredExtensionBackendModel extends DiscoveredExtensionBaseModel {
	@ApiProperty({ name: 'route_prefix', description: 'Route prefix', type: 'string', example: '/api' })
	@Expose({ name: 'route_prefix' })
	@IsString()
	routePrefix: string;

	@ApiProperty({ description: 'Extension type', type: 'string', example: 'backend' })
	@Expose()
	@IsString()
	type: string = 'backend';
}
