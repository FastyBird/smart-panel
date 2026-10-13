import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import type { CompositeChildStatus } from '../services/composite-property-command.registry.service';

@ApiSchema({ name: 'DevicesModuleDataCompositeCommandChildOutcome' })
export class CompositeCommandChildOutcomeModel {
	@ApiPropertyOptional({ description: 'Intended physical channel identity captured before remap or deletion' })
	@Expose()
	memberIdentity?: string;

	@ApiPropertyOptional({
		type: 'string',
		nullable: true,
		description: 'Original intended physical property identity, including a cleared live FK',
	})
	@Expose()
	propertyIdentity?: string | null;

	@ApiPropertyOptional({
		oneOf: [{ type: 'number' }, { type: 'boolean' }, { type: 'string' }],
		description: 'Exact prepared physical target value',
	})
	@Expose()
	value?: string | number | boolean;

	@ApiProperty({ description: 'Stable intended member identity' })
	@Expose()
	memberId: string;

	@ApiProperty({
		description: 'Canonical property, null for a missing intended member',
		type: 'string',
		nullable: true,
	})
	@Expose()
	propertyId: string | null;

	@ApiProperty({ enum: ['accepted', 'confirmed', 'failed', 'unavailable', 'superseded', 'timed_out'] })
	@Expose()
	status: CompositeChildStatus;

	@ApiPropertyOptional({ description: 'Failure or availability reason' })
	@Expose()
	reason?: string;

	@ApiPropertyOptional({ description: 'Exact physical command generation' })
	@Expose()
	generation?: string;
}

@ApiSchema({ name: 'DevicesModuleDataCompositeCommandOutcome' })
export class CompositeCommandOutcomeModel {
	@ApiProperty({ description: 'Parent correlation identifier' })
	@Expose()
	id: string;

	@ApiProperty({ enum: ['confirmed', 'partial', 'failed'] })
	@Expose()
	status: 'confirmed' | 'partial' | 'failed';

	@ApiProperty({ type: [CompositeCommandChildOutcomeModel] })
	@Expose()
	@Type(() => CompositeCommandChildOutcomeModel)
	children: CompositeCommandChildOutcomeModel[];
}
