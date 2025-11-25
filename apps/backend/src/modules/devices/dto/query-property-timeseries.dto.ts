import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsDateString,
	IsIn,
	IsOptional,
	Validate,
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom validator to ensure:
 * - either both `from` and `to` are provided, or neither
 * - and if both are provided, then from < to
 */
@ValidatorConstraint({ name: 'timeRangeValid', async: false })
export class TimeRangeValidator implements ValidatorConstraintInterface {
	validate(_: unknown, args: ValidationArguments): boolean {
		const obj = args.object as QueryPropertyTimeseriesDto;
		const { from, to } = obj;

		const bothProvided = from != null && to != null;
		const neitherProvided = from == null && to == null;

		if (!bothProvided && !neitherProvided) {
			return false;
		}

		if (bothProvided) {
			const fromDate = new Date(from);
			const toDate = new Date(to);

			return fromDate < toDate;
		}

		return true;
	}

	defaultMessage(): string {
		return 'Both "from" and "to" must be provided together, and "from" must be before "to"';
	}
}

@ApiSchema({ name: 'DevicesModuleQueryPropertyTimeseries' })
export class QueryPropertyTimeseriesDto {
	@ApiPropertyOptional({
		description: 'Start date for timeseries query',
		type: 'string',
		format: 'date-time',
		example: '2024-01-01T00:00:00Z',
	})
	@IsOptional()
	@IsDateString()
	@Validate(TimeRangeValidator)
	from?: string;

	@ApiPropertyOptional({
		description: 'End date for timeseries query',
		type: 'string',
		format: 'date-time',
		example: '2024-01-31T23:59:59Z',
	})
	@IsOptional()
	@IsDateString()
	@Validate(TimeRangeValidator)
	to?: string;

	@ApiPropertyOptional({
		description: 'Time bucket aggregation interval',
		enum: ['1m', '5m', '15m', '1h'],
		example: '1h',
	})
	@IsOptional()
	@IsIn(['1m', '5m', '15m', '1h'])
	bucket?: '1m' | '5m' | '15m' | '1h';
}
