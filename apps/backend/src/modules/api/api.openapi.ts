/**
 * OpenAPI extra models for API module
 */
import {
	BadRequestErrorModel,
	BaseErrorResponseModel,
	BaseSuccessResponseModel,
	ErrorDetailFieldModel,
	ErrorObjectModel,
	ForbiddenErrorModel,
	InternalServerErrorModel,
	NotFoundErrorModel,
	ResponseMetadataModel,
	SuccessMetadataModel,
	UnprocessableEntityErrorModel,
} from './models/api-response.model';
import { ErrorRate5MinModel, ModuleStatsModel, P95Ms5MModel, RequestsPerMinModel } from './models/api.model';

export const API_SWAGGER_EXTRA_MODELS = [
	// Response models
	BaseSuccessResponseModel,
	BaseErrorResponseModel,
	BadRequestErrorModel,
	ForbiddenErrorModel,
	NotFoundErrorModel,
	UnprocessableEntityErrorModel,
	InternalServerErrorModel,
	// Data models
	ErrorDetailFieldModel,
	ErrorObjectModel,
	ResponseMetadataModel,
	SuccessMetadataModel,
	RequestsPerMinModel,
	ErrorRate5MinModel,
	P95Ms5MModel,
	ModuleStatsModel,
];
