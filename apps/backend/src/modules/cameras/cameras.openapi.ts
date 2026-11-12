/**
 * OpenAPI extra models for Cameras module
 */
import { UpdateCamerasConfigDto } from './dto/update-config.dto';
import { CameraModel, CameraStreamProfileModel } from './models/camera.model';
import { CameraResponseModel, CamerasResponseModel } from './models/cameras-response.model';
import { CamerasConfigModel } from './models/config.model';

export const CAMERAS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	CamerasConfigModel,
	UpdateCamerasConfigDto,
	// Data models
	CameraStreamProfileModel,
	CameraModel,
	// Response models
	CameraResponseModel,
	CamerasResponseModel,
];
