/**
 * OpenAPI extra models for Cameras module
 */
import { CreateCameraSessionDto, ReqCreateCameraSessionDto } from './dto/create-session.dto';
import { UpdateCamerasConfigDto } from './dto/update-config.dto';
import { CameraModel, CameraStreamProfileModel } from './models/camera.model';
import { CameraResponseModel, CameraSessionResponseModel, CamerasResponseModel } from './models/cameras-response.model';
import { CamerasConfigModel } from './models/config.model';
import { CameraSessionModel } from './models/session.model';

export const CAMERAS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	CamerasConfigModel,
	UpdateCamerasConfigDto,
	// Request DTOs
	CreateCameraSessionDto,
	ReqCreateCameraSessionDto,
	// Data models
	CameraStreamProfileModel,
	CameraModel,
	CameraSessionModel,
	// Response models
	CameraResponseModel,
	CamerasResponseModel,
	CameraSessionResponseModel,
];
