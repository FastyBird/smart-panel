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

export class QueryPropertyTimeseriesDto {
	@IsOptional()
	@IsDateString()
	@Validate(TimeRangeValidator)
	from?: string;

	@IsOptional()
	@IsDateString()
	@Validate(TimeRangeValidator)
	to?: string;

	@IsOptional()
	@IsIn(['1m', '5m', '15m', '1h'])
	bucket?: '1m' | '5m' | '15m' | '1h';
}
