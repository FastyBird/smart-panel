import { Type, applyDecorators } from '@nestjs/common';
import { ApiResponse, getSchemaPath } from '@nestjs/swagger';

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
 */
export const ApiCreatedSuccessResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataModel: TModel,
	description?: string,
) => {
	return createSuccessResponseDecorator(201, 'Resource created successfully', dataModel, description);
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
