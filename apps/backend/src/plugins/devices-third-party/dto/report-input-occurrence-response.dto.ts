import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesThirdPartyPluginReportInputOccurrenceResponse' })
export class ReportInputOccurrenceResponseDto {
	@ApiProperty({
		description: 'Assigned occurrence UUID',
		example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
	})
	@Expose()
	@IsUUID()
	id: string;

	@ApiProperty({
		description: 'Ingestion timestamp in ISO format',
		example: '2026-03-30T12:00:00.000Z',
	})
	@Expose()
	@IsString()
	timestamp: string;

	@ApiProperty({
		description: 'Reported event name',
		example: 'press',
	})
	@Expose()
	@IsString()
	@IsNotEmpty()
	event: string;
}
