import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { IntentRecord } from './intent.model';

/**
 * Response wrapper for a single IntentRecord
 */
@ApiSchema({ name: 'IntentsModuleResIntent' })
export class IntentResponseModel extends BaseSuccessResponseModel<IntentRecord> {
	@ApiProperty({
		description: 'The intent data',
		type: () => IntentRecord,
	})
	@Expose()
	declare data: IntentRecord;
}

/**
 * Response wrapper for array of IntentRecord
 */
@ApiSchema({ name: 'IntentsModuleResIntents' })
export class IntentsResponseModel extends BaseSuccessResponseModel<IntentRecord[]> {
	@ApiProperty({
		description: 'List of intents',
		type: 'array',
		items: { $ref: getSchemaPath(IntentRecord) },
	})
	@Expose()
	declare data: IntentRecord[];
}

/**
 * Response wrapper for active intents count
 */
@ApiSchema({ name: 'IntentsModuleResActiveCount' })
export class IntentsActiveCountResponseModel extends BaseSuccessResponseModel<{ count: number }> {
	@ApiProperty({
		description: 'Count of active (pending) intents',
		type: 'object',
		properties: {
			count: {
				type: 'number',
				description: 'Number of active intents',
				example: 5,
			},
		},
	})
	@Expose()
	declare data: { count: number };
}
