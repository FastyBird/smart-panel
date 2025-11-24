import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiProperty, ApiResponse, getSchemaPath } from '@nestjs/swagger';

import { RequestResultState } from '../../app.constants';
import {
	BadRequestErrorDto,
	BaseErrorResponseDto,
	BaseSuccessResponseDto,
	ErrorObjectDto,
	ForbiddenErrorDto,
	InternalServerErrorDto,
	NotFoundErrorDto,
	ResponseMetadataDto,
	SuccessMetadataDto,
} from '../dto/response.dto';

/**
 * Base response wrapper for API responses
 */
export class ApiResponseDto<T> {
	@ApiProperty({ enum: RequestResultState })
	state!: RequestResultState;

	@ApiProperty()
	data?: T;

	@ApiProperty({ required: false })
	error?: string;
}

/**
 * Helper function to create a success response decorator with a specific status code
 * @param status HTTP status code
 * @param defaultDescription Default description for the response
 * @param dataDto The DTO class for the response data
 * @param description Optional custom description for the response
 */
const createSuccessResponseDecorator = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	status: number,
	defaultDescription: string,
	dataDto: TModel,
	description?: string,
) => {
	return applyDecorators(
		ApiExtraModels(BaseSuccessResponseDto, SuccessMetadataDto, dataDto),
		ApiResponse({
			status,
			description: description || defaultDescription,
			schema: {
				allOf: [
					{ $ref: getSchemaPath(BaseSuccessResponseDto) },
					{
						properties: {
							status: {
								type: 'string',
								enum: ['success'],
							},
							data: {
								$ref: getSchemaPath(dataDto),
							},
							metadata: {
								$ref: getSchemaPath(SuccessMetadataDto),
							},
						},
					},
				],
			},
		}),
	);
};

/**
 * Creates a Swagger decorator for successful responses with typed data
 * @param dataDto The DTO class for the response data
 * @param description Optional description for the response
 */
export const ApiSuccessResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataDto: TModel,
	description?: string,
) => {
	return createSuccessResponseDecorator(200, 'Successful response', dataDto, description);
};

/**
 * Creates a Swagger decorator for successful creation responses with typed data
 * @param dataDto The DTO class for the response data
 * @param description Optional description for the response
 */
export const ApiCreatedSuccessResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataDto: TModel,
	description?: string,
) => {
	return createSuccessResponseDecorator(201, 'Resource created successfully', dataDto, description);
};

/**
 * Creates a Swagger decorator for successful accepted responses with typed data
 * @param dataDto The DTO class for the response data
 * @param description Optional description for the response
 */
export const ApiAcceptedSuccessResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataDto: TModel,
	description?: string,
) => {
	return createSuccessResponseDecorator(202, 'Request accepted successfully', dataDto, description);
};

/**
 * Helper function to create a discriminated response decorator with a specific status code
 * @param status HTTP status code
 * @param defaultDescription Default description for the response
 * @param discriminatorProperty The property name used for discrimination (e.g., 'type')
 * @param mapping Object mapping discriminator values to schema paths
 * @param schemas Array of DTO classes for the discriminated types
 * @param description Optional custom description for the response
 */
const createDiscriminatedResponseDecorator = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	status: number,
	defaultDescription: string,
	discriminatorProperty: string,
	mapping: Record<string, string>,
	schemas: TModel[],
	description?: string,
) => {
	return applyDecorators(
		ApiExtraModels(BaseSuccessResponseDto, SuccessMetadataDto, ...schemas),
		ApiResponse({
			status,
			description: description || defaultDescription,
			schema: {
				allOf: [
					{ $ref: getSchemaPath(BaseSuccessResponseDto) },
					{
						properties: {
							status: {
								type: 'string',
								enum: ['success'],
							},
							data: {
								discriminator: {
									propertyName: discriminatorProperty,
									mapping,
								},
								oneOf: schemas.map((schema) => ({ $ref: getSchemaPath(schema) })),
							},
							metadata: {
								$ref: getSchemaPath(SuccessMetadataDto),
							},
						},
					},
				],
			},
		}),
	);
};

/**
 * Creates a Swagger decorator for successful responses with discriminated union data
 * @param discriminatorProperty The property name used for discrimination (e.g., 'type')
 * @param mapping Object mapping discriminator values to schema paths
 * @param schemas Array of DTO classes for the discriminated types
 * @param description Optional description for the response
 */
export const ApiSuccessDiscriminatedResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	discriminatorProperty: string,
	mapping: Record<string, string>,
	schemas: TModel[],
	description?: string,
) => {
	return createDiscriminatedResponseDecorator(
		200,
		'Successful response',
		discriminatorProperty,
		mapping,
		schemas,
		description,
	);
};

/**
 * Creates a Swagger decorator for successful creation responses with discriminated union data
 * @param discriminatorProperty The property name used for discrimination (e.g., 'type')
 * @param mapping Object mapping discriminator values to schema paths
 * @param schemas Array of DTO classes for the discriminated types
 * @param description Optional description for the response
 */
export const ApiCreatedSuccessDiscriminatedResponse = <
	TModel extends Type<any> | (abstract new (...args: any[]) => any),
>(
	discriminatorProperty: string,
	mapping: Record<string, string>,
	schemas: TModel[],
	description?: string,
) => {
	return createDiscriminatedResponseDecorator(
		201,
		'Resource created successfully',
		discriminatorProperty,
		mapping,
		schemas,
		description,
	);
};

/**
 * Creates a Swagger decorator for successful responses with array of discriminated union data
 * @param discriminatorProperty The property name used for discrimination (e.g., 'type')
 * @param mapping Object mapping discriminator values to schema paths
 * @param schemas Array of DTO classes for the discriminated types
 * @param description Optional description for the response
 */
export const ApiSuccessArrayDiscriminatedResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	discriminatorProperty: string,
	mapping: Record<string, string>,
	schemas: TModel[],
	description?: string,
) => {
	return applyDecorators(
		ApiExtraModels(BaseSuccessResponseDto, SuccessMetadataDto, ...schemas),
		ApiOkResponse({
			description: description || 'Successful response',
			schema: {
				allOf: [
					{ $ref: getSchemaPath(BaseSuccessResponseDto) },
					{
						properties: {
							status: {
								type: 'string',
								enum: ['success'],
							},
							data: {
								type: 'array',
								items: {
									discriminator: {
										propertyName: discriminatorProperty,
										mapping,
									},
									oneOf: schemas.map((schema) => ({ $ref: getSchemaPath(schema) })),
								},
							},
							metadata: {
								$ref: getSchemaPath(SuccessMetadataDto),
							},
						},
					},
				],
			},
		}),
	);
};

/**
 * Creates a Swagger decorator for successful responses with union type data (oneOf without discriminator)
 * @param schemas Array of DTO classes for the union types
 * @param description Optional description for the response
 */
export const ApiSuccessUnionResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	schemas: TModel[],
	description?: string,
) => {
	return applyDecorators(
		ApiExtraModels(BaseSuccessResponseDto, SuccessMetadataDto, ...schemas),
		ApiOkResponse({
			description: description || 'Successful response',
			schema: {
				allOf: [
					{ $ref: getSchemaPath(BaseSuccessResponseDto) },
					{
						properties: {
							status: {
								type: 'string',
								enum: ['success'],
							},
							data: {
								oneOf: schemas.map((schema) => ({ $ref: getSchemaPath(schema) })),
							},
							metadata: {
								$ref: getSchemaPath(SuccessMetadataDto),
							},
						},
					},
				],
			},
		}),
	);
};

/**
 * Creates a Swagger decorator for successful responses with array data
 * @param dataDto The DTO class for the array items
 * @param description Optional description for the response
 */
export const ApiSuccessArrayResponse = <TModel extends Type<any> | (abstract new (...args: any[]) => any)>(
	dataDto: TModel,
	description?: string,
) => {
	return applyDecorators(
		ApiExtraModels(BaseSuccessResponseDto, SuccessMetadataDto, dataDto),
		ApiOkResponse({
			description: description || 'Successful response',
			schema: {
				allOf: [
					{ $ref: getSchemaPath(BaseSuccessResponseDto) },
					{
						properties: {
							status: {
								type: 'string',
								enum: ['success'],
							},
							data: {
								type: 'array',
								items: {
									$ref: getSchemaPath(dataDto),
								},
							},
							metadata: {
								$ref: getSchemaPath(SuccessMetadataDto),
							},
						},
					},
				],
			},
		}),
	);
};

/**
 * Decorator for 400 Bad Request error response
 */
export const ApiBadRequestResponse = (description?: string) => {
	return applyDecorators(
		ApiExtraModels(BaseErrorResponseDto, ErrorObjectDto, ResponseMetadataDto, BadRequestErrorDto),
		ApiResponse({
			status: 400,
			description: description || 'The request parameters were invalid.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseDto) }, { $ref: getSchemaPath(BadRequestErrorDto) }],
			},
		}),
	);
};

/**
 * Decorator for 403 Forbidden error response
 */
export const ApiForbiddenResponse = (description?: string) => {
	return applyDecorators(
		ApiExtraModels(BaseErrorResponseDto, ErrorObjectDto, ResponseMetadataDto, ForbiddenErrorDto),
		ApiResponse({
			status: 403,
			description: description || 'Access to this resource is forbidden.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseDto) }, { $ref: getSchemaPath(ForbiddenErrorDto) }],
			},
		}),
	);
};

/**
 * Decorator for 404 Not Found error response
 */
export const ApiNotFoundResponse = (description?: string) => {
	return applyDecorators(
		ApiExtraModels(BaseErrorResponseDto, ErrorObjectDto, ResponseMetadataDto, NotFoundErrorDto),
		ApiResponse({
			status: 404,
			description: description || 'The requested resource was not found.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseDto) }, { $ref: getSchemaPath(NotFoundErrorDto) }],
			},
		}),
	);
};

/**
 * Decorator for 500 Internal Server Error response
 */
export const ApiInternalServerErrorResponse = (description?: string) => {
	return applyDecorators(
		ApiExtraModels(BaseErrorResponseDto, ErrorObjectDto, ResponseMetadataDto, InternalServerErrorDto),
		ApiResponse({
			status: 500,
			description: description || 'An unexpected server error occurred.',
			schema: {
				allOf: [{ $ref: getSchemaPath(BaseErrorResponseDto) }, { $ref: getSchemaPath(InternalServerErrorDto) }],
			},
		}),
	);
};

/**
 * Decorator that combines all common error responses (400, 404, 500)
 */
export const ApiCommonErrorResponses = () => {
	return applyDecorators(ApiBadRequestResponse(), ApiNotFoundResponse(), ApiInternalServerErrorResponse());
};
