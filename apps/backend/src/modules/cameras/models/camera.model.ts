import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'CamerasModuleDataStreamProfile' })
export class CameraStreamProfileModel {
	@ApiProperty({ description: 'Stream profile identifier', type: 'string', example: 'medium' })
	@Expose()
	id: string;

	@ApiProperty({
		name: 'channel_id',
		description: 'Camera channel this profile belongs to',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'channel_id' })
	channelId: string | null;

	@ApiProperty({ description: 'Frame width in pixels', type: 'integer', nullable: true, example: 1280 })
	@Expose()
	width: number | null;

	@ApiProperty({ description: 'Frame height in pixels', type: 'integer', nullable: true, example: 720 })
	@Expose()
	height: number | null;

	@ApiProperty({ description: 'Frames per second', type: 'number', nullable: true, example: 25 })
	@Expose()
	fps: number | null;

	@ApiProperty({
		name: 'video_codec',
		description: 'Video codec',
		type: 'string',
		nullable: true,
		example: 'h264',
	})
	@Expose({ name: 'video_codec' })
	videoCodec: string | null;

	@ApiProperty({
		name: 'audio_codec',
		description: 'Audio codec',
		type: 'string',
		nullable: true,
		example: 'aac',
	})
	@Expose({ name: 'audio_codec' })
	audioCodec: string | null;

	@ApiProperty({ description: 'Whether the profile can be streamed right now', type: 'boolean', example: true })
	@Expose()
	available: boolean;

	@ApiProperty({
		name: 'unavailable_reason',
		description: 'Short machine code explaining why the profile is unavailable',
		type: 'string',
		nullable: true,
		example: 'stream_not_enabled',
	})
	@Expose({ name: 'unavailable_reason' })
	unavailableReason: string | null;
}

@ApiSchema({ name: 'CamerasModuleDataCamera' })
export class CameraModel {
	@ApiProperty({ name: 'device_id', description: 'Camera device identifier', type: 'string', format: 'uuid' })
	@Expose({ name: 'device_id' })
	deviceId: string;

	@ApiProperty({ description: 'Device name', type: 'string', example: 'Front door' })
	@Expose()
	name: string;

	@ApiProperty({ description: 'Device category', type: 'string', example: 'camera' })
	@Expose()
	category: string;

	@ApiProperty({ description: 'Device type (integration discriminator)', type: 'string' })
	@Expose()
	type: string;

	@ApiProperty({
		name: 'live_view',
		description: 'Whether an integration provides live view for this camera',
		type: 'boolean',
	})
	@Expose({ name: 'live_view' })
	liveView: boolean;

	@ApiProperty({
		description: 'Available stream profiles; empty when live view is not supported or the provider is unreachable',
		type: () => [CameraStreamProfileModel],
	})
	@Expose()
	@Type(() => CameraStreamProfileModel)
	profiles: CameraStreamProfileModel[];
}
