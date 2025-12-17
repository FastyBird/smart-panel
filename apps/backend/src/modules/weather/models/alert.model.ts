import { Expose, Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

/**
 * Weather alert model representing severe weather warnings
 */
@ApiSchema({ name: 'WeatherModuleDataAlert' })
export class WeatherAlertModel {
	@ApiProperty({
		name: 'sender_name',
		description: 'Name of the alert sender (e.g., NWS, Met Office)',
		type: 'string',
		example: 'NWS Philadelphia - Mount Holly',
	})
	@Expose({ name: 'sender_name' })
	@IsString()
	@Transform(({ obj }: { obj: { sender_name?: string; senderName?: string } }) => obj.sender_name ?? obj.senderName, {
		toClassOnly: true,
	})
	senderName: string;

	@ApiProperty({
		description: 'Alert event name',
		type: 'string',
		example: 'Heat Advisory',
	})
	@Expose()
	@IsString()
	event: string;

	@ApiProperty({
		description: 'Start time of the alert (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2024-01-15T12:00:00.000Z',
	})
	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { start: string | Date | number } }) => {
			const value = obj.start;
			if (typeof value === 'number') return new Date(value * 1000);
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	start: Date;

	@ApiProperty({
		description: 'End time of the alert (ISO 8601)',
		type: 'string',
		format: 'date-time',
		example: '2024-01-16T00:00:00.000Z',
	})
	@Expose()
	@IsDate()
	@Transform(
		({ obj }: { obj: { end: string | Date | number } }) => {
			const value = obj.end;
			if (typeof value === 'number') return new Date(value * 1000);
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: Date }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	end: Date;

	@ApiProperty({
		description: 'Full description of the alert',
		type: 'string',
		example: 'Heat index values up to 105 expected. Drink plenty of fluids...',
	})
	@Expose()
	@IsString()
	description: string;

	@ApiPropertyOptional({
		description: 'Alert tags/categories',
		type: 'array',
		items: { type: 'string' },
		example: ['Extreme temperature value'],
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	tags?: string[] | null = null;
}

/**
 * Response wrapper for location alerts
 */
@ApiSchema({ name: 'WeatherModuleResLocationAlerts' })
export class LocationAlertsResponseModel extends BaseSuccessResponseModel<WeatherAlertModel[]> {
	@ApiProperty({
		description: 'List of weather alerts for the location',
		type: 'array',
		items: { $ref: getSchemaPath(WeatherAlertModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => WeatherAlertModel)
	declare data: WeatherAlertModel[];
}
