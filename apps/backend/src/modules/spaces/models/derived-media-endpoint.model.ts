import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { MediaEndpointType } from '../spaces.constants';

/**
 * Property link – maps a capability to a concrete property ID.
 */
@ApiSchema({ name: 'SpacesModuleDataDerivedMediaPropertyLink' })
export class DerivedMediaPropertyLinkModel {
	@ApiProperty({
		name: 'property_id',
		description: 'ID of the property providing this capability',
		type: 'string',
	})
	@Expose({ name: 'property_id' })
	propertyId: string;
}

/**
 * Remote command links – maps remote capability to command property IDs.
 */
@ApiSchema({ name: 'SpacesModuleDataDerivedMediaRemoteLinks' })
export class DerivedRemoteLinksModel {
	@ApiProperty({
		description: 'Command mappings for remote control',
		type: 'object',
		additionalProperties: { type: 'string' },
	})
	@Expose()
	commands: Record<string, string>;
}

/**
 * Boolean capability flags for a derived media endpoint.
 */
@ApiSchema({ name: 'SpacesModuleDataDerivedMediaCapabilities' })
export class DerivedMediaCapabilitiesModel {
	@ApiProperty({ description: 'Whether power control is available', type: 'boolean' })
	@Expose()
	power: boolean;

	@ApiProperty({ description: 'Whether volume control is available', type: 'boolean' })
	@Expose()
	volume: boolean;

	@ApiProperty({ description: 'Whether mute control is available', type: 'boolean' })
	@Expose()
	mute: boolean;

	@ApiProperty({ description: 'Whether playback control is available', type: 'boolean' })
	@Expose()
	playback: boolean;

	@ApiProperty({ description: 'Whether track metadata is available', type: 'boolean' })
	@Expose()
	track: boolean;

	@ApiProperty({
		name: 'input_select',
		description: 'Whether input/source selection is available',
		type: 'boolean',
	})
	@Expose({ name: 'input_select' })
	inputSelect: boolean;

	@ApiProperty({
		name: 'remote_commands',
		description: 'Whether remote control commands are available',
		type: 'boolean',
	})
	@Expose({ name: 'remote_commands' })
	remoteCommands: boolean;
}

/**
 * Links mapping capabilities to concrete property/command IDs.
 * Only fields for supported capabilities are present.
 */
@ApiSchema({ name: 'SpacesModuleDataDerivedMediaLinks' })
export class DerivedMediaLinksModel {
	@ApiPropertyOptional({
		description: 'Power property link',
		type: () => DerivedMediaPropertyLinkModel,
	})
	@Expose()
	@Type(() => DerivedMediaPropertyLinkModel)
	power?: DerivedMediaPropertyLinkModel;

	@ApiPropertyOptional({
		description: 'Volume property link',
		type: () => DerivedMediaPropertyLinkModel,
	})
	@Expose()
	@Type(() => DerivedMediaPropertyLinkModel)
	volume?: DerivedMediaPropertyLinkModel;

	@ApiPropertyOptional({
		description: 'Mute property link',
		type: () => DerivedMediaPropertyLinkModel,
	})
	@Expose()
	@Type(() => DerivedMediaPropertyLinkModel)
	mute?: DerivedMediaPropertyLinkModel;

	@ApiPropertyOptional({
		name: 'input_select',
		description: 'Input/source selection property link',
		type: () => DerivedMediaPropertyLinkModel,
	})
	@Expose({ name: 'input_select' })
	@Type(() => DerivedMediaPropertyLinkModel)
	inputSelect?: DerivedMediaPropertyLinkModel;

	@ApiPropertyOptional({
		description: 'Playback command property link',
		type: () => DerivedMediaPropertyLinkModel,
	})
	@Expose()
	@Type(() => DerivedMediaPropertyLinkModel)
	playback?: DerivedMediaPropertyLinkModel;

	@ApiPropertyOptional({
		name: 'playback_state',
		description: 'Playback state property link',
		type: () => DerivedMediaPropertyLinkModel,
	})
	@Expose({ name: 'playback_state' })
	@Type(() => DerivedMediaPropertyLinkModel)
	playbackState?: DerivedMediaPropertyLinkModel;

	@ApiPropertyOptional({
		name: 'track_metadata',
		description: 'Track metadata property link',
		type: () => DerivedMediaPropertyLinkModel,
	})
	@Expose({ name: 'track_metadata' })
	@Type(() => DerivedMediaPropertyLinkModel)
	trackMetadata?: DerivedMediaPropertyLinkModel;

	@ApiPropertyOptional({
		description: 'Remote control command links',
		type: () => DerivedRemoteLinksModel,
	})
	@Expose()
	@Type(() => DerivedRemoteLinksModel)
	remote?: DerivedRemoteLinksModel;
}

/**
 * A derived (non-persisted) media endpoint.
 * Represents a functional projection of a device's media capabilities.
 */
@ApiSchema({ name: 'SpacesModuleDataDerivedMediaEndpoint' })
export class DerivedMediaEndpointModel {
	@ApiProperty({
		name: 'endpoint_id',
		description: 'Deterministic endpoint ID: "${spaceId}:${type}:${deviceId}"',
		type: 'string',
		example: 'space123:display:device456',
	})
	@Expose({ name: 'endpoint_id' })
	endpointId: string;

	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space',
		type: 'string',
	})
	@Expose({ name: 'space_id' })
	spaceId: string;

	@ApiProperty({
		name: 'device_id',
		description: 'ID of the source device',
		type: 'string',
	})
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({
		description: 'Functional type of this endpoint',
		enum: MediaEndpointType,
		example: MediaEndpointType.DISPLAY,
	})
	@Expose()
	type: MediaEndpointType;

	@ApiProperty({
		description: 'Human-readable name (device name + type label)',
		type: 'string',
		example: 'Living Room TV (Display)',
	})
	@Expose()
	name: string;

	@ApiProperty({
		description: 'Boolean capability flags',
		type: () => DerivedMediaCapabilitiesModel,
	})
	@Expose()
	@Type(() => DerivedMediaCapabilitiesModel)
	capabilities: DerivedMediaCapabilitiesModel;

	@ApiProperty({
		description: 'Property/command ID mappings for supported capabilities',
		type: () => DerivedMediaLinksModel,
	})
	@Expose()
	@Type(() => DerivedMediaLinksModel)
	links: DerivedMediaLinksModel;
}

/**
 * Result containing all derived endpoints for a space.
 */
@ApiSchema({ name: 'SpacesModuleDataDerivedMediaEndpointsResult' })
export class DerivedMediaEndpointsResultModel {
	@ApiProperty({
		name: 'space_id',
		description: 'ID of the space',
		type: 'string',
	})
	@Expose({ name: 'space_id' })
	spaceId: string;

	@ApiProperty({
		description: 'List of derived media endpoints',
		type: 'array',
		items: { $ref: getSchemaPath(DerivedMediaEndpointModel) },
	})
	@Expose()
	@Type(() => DerivedMediaEndpointModel)
	endpoints: DerivedMediaEndpointModel[];
}

/**
 * Response wrapper for derived media endpoints.
 */
@ApiSchema({ name: 'SpacesModuleResDerivedMediaEndpoints' })
export class DerivedMediaEndpointsResponseModel extends BaseSuccessResponseModel<DerivedMediaEndpointsResultModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DerivedMediaEndpointsResultModel,
	})
	@Expose()
	@Type(() => DerivedMediaEndpointsResultModel)
	declare data: DerivedMediaEndpointsResultModel;
}
