import { Type, applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiSecurity, getSchemaPath } from '@nestjs/swagger';

import {
	BadRequestErrorModel,
	BaseErrorResponseModel,
	ForbiddenErrorModel,
	InternalServerErrorModel,
	NotFoundErrorModel,
	ServiceUnavailableErrorModel,
	UnprocessableEntityErrorModel,
} from '../../api/models/api-response.model';

/**
 * Helper function to create a success response decorator with a specific status code
 * @param status HTTP status code
 * @param defaultDescription Default description for the response
 * @param dataModel The model class for the response data
 * @param description Optional custom description for the response
 */
const createSuccessResponseDecorator = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	status: number,
	defaultDescription: string,
	dataModel: TModel,
	description?: string,
) => {
	return applyDecorators(
		ApiResponse({
			status,
			description: description || defaultDescription,
			schema: { $ref: getSchemaPath(dataModel) },
		}),
	);
};

/**
 * Creates a Swagger decorator for successful responses with typed data
 * @param dataModel The model class for the response data
 * @param description Optional description for the response
 */
export const ApiSuccessResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataModel: TModel,
	description?: string,
) => {
	return createSuccessResponseDecorator(200, 'Successful response', dataModel, description);
};

/**
 * Creates a Swagger decorator for successful creation responses with typed data
 * @param dataModel The model class for the response data
 * @param description Optional description for the response
 * @param locationExample Optional example for the Location header (e.g., '/api/v1/devices/devices/{id}')
 */
export const ApiCreatedSuccessResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataModel: TModel,
	description?: string,
	locationExample?: string,
) => {
	// If locationExample is provided and doesn't start with http:// or https://, add the base URL
	let example: string;
	if (locationExample) {
		if (/^https?:\/\//.test(locationExample)) {
			// Already a full URL, use as is
			example = locationExample;
		} else {
			// Relative path, add base URL
			example = `https://smart-panel.local${locationExample.startsWith('/') ? '' : '/'}${locationExample}`;
		}
	} else {
		// Default example
		example = 'https://smart-panel.local/api/v1/modules/example/example-resource/123e4567-e89b-12d3-a456-426614174000';
	}

	return applyDecorators(
		ApiResponse({
			status: 201,
			description: description || 'Resource created successfully',
			schema: { $ref: getSchemaPath(dataModel) },
			headers: {
				Location: {
					description: 'The URI of the newly created resource',
					schema: {
						type: 'string',
						format: 'uri',
						example,
					},
				},
			},
		}),
	);
};

/**
 * Creates a Swagger decorator for successful accepted responses with typed data
 * @param dataModel The model class for the response data
 * @param description Optional description for the response
 */
export const ApiAcceptedSuccessResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataModel: TModel,
	description?: string,
) => {
	return createSuccessResponseDecorator(202, 'Request accepted successfully', dataModel, description);
};

/**
 * Decorator for 400 Bad Request error response
 */
export const ApiBadRequestResponse = (description?: string) => {
	return applyDecorators(
		ApiResponse({
			status: 400,
			description: description || 'The request parameters were invalid.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseModel) }, { $ref: getSchemaPath(BadRequestErrorModel) }],
			},
		}),
	);
};

/**
 * Decorator for 403 Forbidden error response
 */
export const ApiForbiddenResponse = (description?: string) => {
	return applyDecorators(
		ApiResponse({
			status: 403,
			description: description || 'Access to this resource is forbidden.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseModel) }, { $ref: getSchemaPath(ForbiddenErrorModel) }],
			},
		}),
	);
};

/**
 * Decorator for 404 Not Found error response
 */
export const ApiNotFoundResponse = (description?: string) => {
	return applyDecorators(
		ApiResponse({
			status: 404,
			description: description || 'The requested resource was not found.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseModel) }, { $ref: getSchemaPath(NotFoundErrorModel) }],
			},
		}),
	);
};

/**
 * Decorator for 422 Unprocessable Entity error response
 */
export const ApiUnprocessableEntityResponse = (description?: string) => {
	return applyDecorators(
		ApiResponse({
			status: 422,
			description: description || 'The request was well-formed but could not be processed.',
			schema: {
				allOf: [
					{ $ref: getSchemaPath(BaseErrorResponseModel) },
					{ $ref: getSchemaPath(UnprocessableEntityErrorModel) },
				],
			},
		}),
	);
};

/**
 * Decorator for 500 Internal Server Error response
 */
export const ApiInternalServerErrorResponse = (description?: string) => {
	return applyDecorators(
		ApiResponse({
			status: 500,
			description: description || 'An unexpected server error occurred.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseModel) }, { $ref: getSchemaPath(InternalServerErrorModel) }],
			},
		}),
	);
};

/**
 * Decorator for 503 Service Unavailable error response
 */
export const ApiServiceUnavailableResponse = (description?: string) => {
	return applyDecorators(
		ApiResponse({
			status: 503,
			description: description || 'The service is temporarily unavailable.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseModel) }, { $ref: getSchemaPath(ServiceUnavailableErrorModel) }],
			},
		}),
	);
};

/**
 * Decorator to mark a route as public (no security required) in Swagger.
 * This uses a custom metadata key that will be processed to set security to empty array.
 */
export const API_PUBLIC_METADATA_KEY = 'apiPublic';

export const ApiPublic = () => {
	// Use ApiSecurity with a special marker that will be processed later
	// We'll use a non-existent security scheme name as a marker
	return ApiSecurity('__PUBLIC_ROUTE__');
};
