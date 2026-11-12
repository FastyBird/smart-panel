/**
 * OpenAPI extra models for Cameras module
 */
import { UpdateCamerasConfigDto } from './dto/update-config.dto';
import { CamerasConfigModel } from './models/config.model';

export const CAMERAS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	CamerasConfigModel,
	UpdateCamerasConfigDto,
];
