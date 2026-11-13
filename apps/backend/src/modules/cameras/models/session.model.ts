import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'CamerasModuleDataSession' })
export class CameraSessionModel {
	@ApiProperty({
		name: 'session_id',
		description: 'Session identifier',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'session_id' })
	sessionId: string;

	@ApiProperty({
		description:
			'Relative URL of the live stream. Single use and valid for a short time; resolve it against the origin the API was reached on.',
		type: 'string',
		example: '/api/v1/modules/cameras/live?session=AbC123',
	})
	@Expose()
	url: string;

	@ApiProperty({
		name: 'expires_at',
		description: 'Time after which the session URL is no longer accepted',
		type: 'string',
		format: 'date-time',
	})
	@Expose({ name: 'expires_at' })
	expiresAt: string;
}
