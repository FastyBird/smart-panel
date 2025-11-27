import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

/**
 * Error detail field
 */
export class ErrorDetailFieldModel {
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
export class ErrorObjectModel {
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
	details?: ErrorDetailFieldModel | ErrorDetailFieldModel[] | Record<string, unknown>;
}

/**
 * Response metadata for error responses
 */
export class ResponseMetadataModel {
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
@ApiSchema({ name: 'SuccessMetadataModel' })
export class SuccessMetadataModel {
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
export class CommonResMetadata extends SuccessMetadataModel {}

/**
 * Base error response structure
 */
export class BaseErrorResponseModel {
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
		type: () => ErrorObjectModel,
	})
	error: ErrorObjectModel;

	@ApiProperty({
		description: 'Additional metadata about the request and server performance metrics.',
		type: () => ResponseMetadataModel,
	})
	metadata: ResponseMetadataModel;
}

/**
 * 400 Bad Request Error Response
 */
export class BadRequestErrorModel extends BaseErrorResponseModel {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectModel,
		example: {
			code: 'BadRequestError',
			message: "The 'name' parameter is invalid.",
			details: {
				field: 'name',
				reason: 'Name cannot contain special characters.',
			},
		},
	})
	error: ErrorObjectModel;
}

/**
 * 403 Forbidden Error Response
 */
export class ForbiddenErrorModel extends BaseErrorResponseModel {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectModel,
		example: {
			code: 'ForbiddenError',
			message: 'Access to this resource is forbidden.',
			details: {
				field: 'authorization',
				reason: 'insufficient permissions',
			},
		},
	})
	error: ErrorObjectModel;
}

/**
 * 404 Not Found Error Response
 */
export class NotFoundErrorModel extends BaseErrorResponseModel {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectModel,
		example: {
			code: 'NotFoundError',
			message: 'The specified resource was not found.',
			details: {
				field: 'id',
				reason: 'resource not found',
			},
		},
	})
	error: ErrorObjectModel;
}

/**
 * 422 Unprocessable Entity Error Response
 */
export class UnprocessableEntityErrorModel extends BaseErrorResponseModel {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectModel,
		example: {
			code: 'UnprocessableEntityError',
			message: 'The request was well-formed but could not be processed.',
			details: {
				reason: 'validation failed',
			},
		},
	})
	error: ErrorObjectModel;
}

/**
 * 500 Internal Server Error Response
 */
export class InternalServerErrorModel extends BaseErrorResponseModel {
	@ApiProperty({
		description: 'Error details',
		type: () => ErrorObjectModel,
		example: {
			code: 'InternalServerError',
			message: 'An unexpected error occurred.',
		},
	})
	error: ErrorObjectModel;
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
	status?: string;

	@ApiProperty({
		description: 'Timestamp when the response was generated, in ISO 8601 format',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
		readOnly: true,
	})
	@Expose()
	timestamp?: string;

	@ApiProperty({
		description: 'Unique identifier for this specific API request',
		type: 'string',
		format: 'uuid',
		example: 'b27b7c58-76f6-407a-bc78-4068e4cfd082',
		readOnly: true,
	})
	@Expose({ name: 'request_id' })
	request_id?: string;

	@ApiProperty({
		description: 'The requested API endpoint',
		type: 'string',
		example: '/api/v1/auth-module/auth/login',
		readOnly: true,
	})
	@Expose()
	path?: string;

	@ApiProperty({
		description: 'HTTP method used for the request',
		enum: ['GET', 'POST', 'PATCH', 'DELETE'],
		example: 'POST',
		readOnly: true,
	})
	@Expose()
	method?: string;

	@ApiProperty({
		description: 'The actual data payload returned by the API',
	})
	@Expose()
	data!: T;

	@ApiProperty({
		description: 'Additional metadata about the request and server performance metrics',
		type: () => SuccessMetadataModel,
	})
	@Expose()
	@Type(() => SuccessMetadataModel)
	metadata: SuccessMetadataModel;
}
