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
} from '../dto/error-response.dto';

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
 * Decorator for paginated API responses
 */
export class PaginatedResponseDto<T> {
	@ApiProperty()
	items!: T[];

	@ApiProperty()
	total!: number;

	@ApiProperty()
	page!: number;

	@ApiProperty()
	pageSize!: number;
}

/**
 * Creates a Swagger decorator for successful responses with typed data
 * @param dataDto The DTO class for the response data
 * @param description Optional description for the response
 */
export const ApiSuccessResponse = <TModel extends Type>(dataDto: TModel, description?: string) => {
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
 * Creates a Swagger decorator for successful creation responses with typed data
 * @param dataDto The DTO class for the response data
 * @param description Optional description for the response
 */
export const ApiCreatedSuccessResponse = <TModel extends Type>(dataDto: TModel, description?: string) => {
	return applyDecorators(
		ApiExtraModels(BaseSuccessResponseDto, SuccessMetadataDto, dataDto),
		ApiResponse({
			status: 201,
			description: description || 'Resource created successfully',
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
 * Creates a Swagger decorator for successful responses with array data
 * @param dataDto The DTO class for the array items
 * @param description Optional description for the response
 */
export const ApiSuccessArrayResponse = <TModel extends Type>(dataDto: TModel, description?: string) => {
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
 * Creates a Swagger decorator for paginated responses
 * @param dataDto The DTO class for the paginated items
 * @param description Optional description for the response
 */
export const ApiPaginatedResponse = <TModel extends Type>(dataDto: TModel, description?: string) => {
	return applyDecorators(
		ApiExtraModels(PaginatedResponseDto, dataDto),
		ApiOkResponse({
			description: description || 'Paginated response',
			schema: {
				allOf: [
					{ $ref: getSchemaPath(ApiResponseDto) },
					{
						properties: {
							state: {
								type: 'string',
								enum: [RequestResultState.SUCCESS],
							},
							data: {
								allOf: [
									{ $ref: getSchemaPath(PaginatedResponseDto) },
									{
										properties: {
											items: {
												type: 'array',
												items: { $ref: getSchemaPath(dataDto) },
											},
										},
									},
								],
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
