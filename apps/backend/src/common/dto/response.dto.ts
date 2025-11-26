import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

/**
 * Error detail field
 */
export class ErrorDetailFieldDto {
	@ApiProperty({
		description: 'Field name that caused the error',
		type: 'string',
		example: 'name',
		readOnly: true,
	})
	field: string;

	@ApiProperty({
		description: 'Reason for the error',
		type: 'string',
		example: 'Name cannot contain special characters.',
		readOnly: true,
	})
	reason: string;
}

/**
 * Error object containing code, message, and optional details
 */
export class ErrorObjectDto {
	@ApiProperty({
		description: 'Short error code indicating the type of error.',
		type: 'string',
		example: 'BadRequestError',
		readOnly: true,
	})
	code: string;

	@ApiProperty({
		description: 'Detailed error message for debugging or client display.',
		type: 'string',
		example: "The 'name' parameter is invalid.",
		readOnly: true,
	})
	message: string;

	@ApiPropertyOptional({
		description: 'Additional information about the error, if available.',
		oneOf: [
			{ type: 'object', additionalProperties: true },
			{ type: 'array', items: { type: 'object' } },
		],
	})
	details?: ErrorDetailFieldDto | ErrorDetailFieldDto[] | Record<string, unknown>;
}

/**
 * Response metadata for error responses
 */
export class ResponseMetadataDto {
	@ApiProperty({
		description: 'Server timestamp in ISO 8601 format',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
		readOnly: true,
	})
	server_time: string;

	@ApiProperty({
		description: 'CPU usage percentage',
		type: 'number',
		format: 'float',
		example: 30.73,
		readOnly: true,
	})
	cpu_usage: number;
}

/**
 * Response metadata for success responses
 */
@ApiSchema({ name: 'SuccessMetadataDto' })
export class SuccessMetadataDto {
	@ApiProperty({
		description: 'The total time taken to process the request, in milliseconds',
		type: 'number',
		format: 'float',
		example: 57,
		readOnly: true,
	})
	@Expose({ name: 'request_duration_ms' })
	request_duration_ms: number;

	@ApiProperty({
		description: "The server's current timestamp when the response was generated, in ISO 8601 format",
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
		readOnly: true,
	})
	@Expose({ name: 'server_time' })
	server_time: string;

	@ApiProperty({
		description: 'The CPU usage percentage at the time of processing the request',
		type: 'number',
		format: 'float',
		example: 25.28,
		readOnly: true,
	})
	@Expose({ name: 'cpu_usage' })
	cpu_usage: number;
}

/**
 * Alias for OpenAPI spec compatibility
 */
@ApiSchema({ name: 'CommonResMetadata' })
export class CommonResMetadata extends SuccessMetadataDto {}

/**
 * Base error response structure
 */
export class BaseErrorResponseDto {
	@ApiProperty({
		description: 'Response status indicator',
		type: 'string',
		example: 'error',
		readOnly: true,
	})
	status: string;

	@ApiProperty({
		description: 'Timestamp when the error occurred in ISO 8601 format.',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
		readOnly: true,
	})
	timestamp: string;

	@ApiProperty({
		description: 'Unique identifier for this specific API request.',
		type: 'string',
		format: 'uuid',
		example: 'b27b7c58-76f6-407a-bc78-4068e4cfd082',
		readOnly: true,
	})
	request_id: string;

	@ApiProperty({
		description: 'The requested API endpoint.',
		type: 'string',
		example: '/api/v1/some-module/path/to/endpoint',
		readOnly: true,
	})
	path: string;

	@ApiProperty({
		description: 'HTTP method used for the request',
		enum: ['GET', 'POST', 'PATCH', 'DELETE'],
		example: 'POST',
		readOnly: true,
	})
	method: string;

	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectDto,
	})
	error: ErrorObjectDto;

	@ApiProperty({
		description: 'Additional metadata about the request and server performance metrics.',
		type: () => ResponseMetadataDto,
	})
	metadata: ResponseMetadataDto;
}

/**
 * 400 Bad Request Error Response
 */
export class BadRequestErrorDto extends BaseErrorResponseDto {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectDto,
		example: {
			code: 'BadRequestError',
			message: "The 'name' parameter is invalid.",
			details: {
				field: 'name',
				reason: 'Name cannot contain special characters.',
			},
		},
	})
	error: ErrorObjectDto;
}

/**
 * 403 Forbidden Error Response
 */
export class ForbiddenErrorDto extends BaseErrorResponseDto {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectDto,
		example: {
			code: 'ForbiddenError',
			message: 'Access to this resource is forbidden.',
			details: {
				field: 'authorization',
				reason: 'insufficient permissions',
			},
		},
	})
	error: ErrorObjectDto;
}

/**
 * 404 Not Found Error Response
 */
export class NotFoundErrorDto extends BaseErrorResponseDto {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectDto,
		example: {
			code: 'NotFoundError',
			message: 'The specified resource was not found.',
			details: {
				field: 'id',
				reason: 'resource not found',
			},
		},
	})
	error: ErrorObjectDto;
}

/**
 * 422 Unprocessable Entity Error Response
 */
export class UnprocessableEntityErrorDto extends BaseErrorResponseDto {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectDto,
		example: {
			code: 'UnprocessableEntityError',
			message: 'The request was well-formed but could not be processed.',
			details: {
				reason: 'validation failed',
			},
		},
	})
	error: ErrorObjectDto;
}

/**
 * 500 Internal Server Error Response
 */
export class InternalServerErrorDto extends BaseErrorResponseDto {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectDto,
		example: {
			code: 'InternalServerError',
			message: 'An unexpected error occurred.',
		},
	})
	error: ErrorObjectDto;
}

/**
 * Base success response structure
 */
@ApiSchema({ name: 'BaseSuccessResponseModel' })
export class BaseSuccessResponseModel<T = unknown> {
	@ApiProperty({
		description: 'Response status indicator',
		type: 'string',
		enum: ['success'],
		example: 'success',
		readOnly: true,
	})
	@Expose()
	status: string;

	@ApiProperty({
		description: 'Timestamp when the response was generated, in ISO 8601 format',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
		readOnly: true,
	})
	@Expose()
	timestamp: string;

	@ApiProperty({
		description: 'Unique identifier for this specific API request',
		type: 'string',
		format: 'uuid',
		example: 'b27b7c58-76f6-407a-bc78-4068e4cfd082',
		readOnly: true,
	})
	@Expose({ name: 'request_id' })
	request_id: string;

	@ApiProperty({
		description: 'The requested API endpoint',
		type: 'string',
		example: '/api/v1/auth-module/auth/login',
		readOnly: true,
	})
	@Expose()
	path: string;

	@ApiProperty({
		description: 'HTTP method used for the request',
		enum: ['GET', 'POST', 'PATCH', 'DELETE'],
		example: 'POST',
		readOnly: true,
	})
	@Expose()
	method: string;

	@ApiProperty({
		description: 'The actual data payload returned by the API',
	})
	@Expose()
	data: T;

	@ApiProperty({
		description: 'Additional metadata about the request and server performance metrics',
		type: () => SuccessMetadataDto,
	})
	@Expose()
	@Type(() => SuccessMetadataDto)
	metadata: SuccessMetadataDto;
}
