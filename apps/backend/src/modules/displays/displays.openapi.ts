/**
 * OpenAPI extra models for Displays module
 */
import { RegisterDisplayDto, ReqRegisterDisplayDto } from './dto/register-display.dto';
import { ReqUpdateDisplayDto, UpdateDisplayDto } from './dto/update-display.dto';
import { DisplayEntity } from './entities/displays.entity';
import {
	DisplayRegistrationDataModel,
	DisplayRegistrationResponseModel,
	DisplayResponseModel,
	DisplayTokenRefreshDataModel,
	DisplayTokenRefreshResponseModel,
	DisplayTokensResponseModel,
	DisplaysResponseModel,
	PermitJoinDataModel,
	PermitJoinResponseModel,
	PermitJoinStatusDataModel,
	PermitJoinStatusResponseModel,
	RegistrationStatusDataModel,
	RegistrationStatusResponseModel,
} from './models/displays-response.model';

export const DISPLAYS_SWAGGER_EXTRA_MODELS = [
	// DTOs
	RegisterDisplayDto,
	ReqRegisterDisplayDto,
	UpdateDisplayDto,
	ReqUpdateDisplayDto,
	// Response models
	DisplayResponseModel,
	DisplaysResponseModel,
	DisplayRegistrationDataModel,
	DisplayRegistrationResponseModel,
	DisplayTokenRefreshDataModel,
	DisplayTokenRefreshResponseModel,
	DisplayTokensResponseModel,
	// Entities
	DisplayEntity,
];
