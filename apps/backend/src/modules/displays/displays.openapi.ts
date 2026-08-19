/**
 * OpenAPI extra models for Displays module
 */
import { RegisterDisplayDto, ReqRegisterDisplayDto } from './dto/register-display.dto';
import { ReqUpdateDisplayDto, UpdateDisplayDto } from './dto/update-display.dto';
import { DisplayEntity } from './entities/displays.entity';
import { DisplaysConfigModel } from './models/config.model';
import {
	BulkResultResponseModel,
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
	// Module configuration
	DisplaysConfigModel,
	// DTOs
	RegisterDisplayDto,
	ReqRegisterDisplayDto,
	UpdateDisplayDto,
	ReqUpdateDisplayDto,
	// Response models
	BulkResultResponseModel,
	DisplayResponseModel,
	DisplaysResponseModel,
	DisplayRegistrationDataModel,
	DisplayRegistrationResponseModel,
	DisplayTokenRefreshDataModel,
	DisplayTokenRefreshResponseModel,
	DisplayTokensResponseModel,
	PermitJoinDataModel,
	PermitJoinResponseModel,
	PermitJoinStatusDataModel,
	PermitJoinStatusResponseModel,
	RegistrationStatusDataModel,
	RegistrationStatusResponseModel,
	// Entities
	DisplayEntity,
];
