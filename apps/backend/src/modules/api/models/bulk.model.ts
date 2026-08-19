import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

/**
 * One item of a bulk operation that did not go through.
 *
 * A bulk endpoint replaces a sequence of individual requests, each of which
 * could fail on its own, so the outcome has to stay per item: one resource
 * refusing must not discard the rest of the selection.
 */
@ApiSchema({ name: 'CommonDataBulkFailure' })
export class BulkFailureModel {
	@ApiProperty({
		description: 'Identifier of the item that could not be processed',
		type: 'string',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description: 'Why this item could not be processed',
		type: 'string',
		example: 'Requested item does not exist',
	})
	@Expose()
	reason: string;
}

/**
 * Outcome of a bulk operation.
 *
 * Shared across modules on purpose: every bulk endpoint answers the same
 * question, so a caller that can read one can read all of them. Identifiers are
 * plain strings rather than UUIDs because not every resource is keyed by one -
 * extensions are keyed by their type.
 */
@ApiSchema({ name: 'CommonDataBulkResult' })
export class BulkResultModel {
	@ApiProperty({
		description: 'Identifiers of the items that were processed successfully',
		type: 'array',
		items: { type: 'string' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose()
	succeeded: string[];

	@ApiProperty({
		description: 'Items that could not be processed, each with its reason',
		type: 'array',
		items: { $ref: getSchemaPath(BulkFailureModel) },
	})
	@Expose()
	@Type(() => BulkFailureModel)
	failed: BulkFailureModel[];
}
