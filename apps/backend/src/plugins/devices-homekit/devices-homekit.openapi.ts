import { HomeKitMapDevicesDto, ReqHomeKitMapDevicesDto } from './dto/bridge-map.dto';
import { HomeKitUpdatePluginConfigDto } from './dto/update-config.dto';
import { HomeKitCandidatesResponseModel, HomeKitDeviceCandidateModel } from './models/bridge-candidate.model';
import { HomeKitBridgeStatusModel, HomeKitBridgeStatusResponseModel } from './models/bridge-status.model';
import { HomeKitConfigModel } from './models/config.model';

export const DEVICES_HOMEKIT_PLUGIN_SWAGGER_EXTRA_MODELS = [
	HomeKitConfigModel,
	HomeKitUpdatePluginConfigDto,
	HomeKitBridgeStatusModel,
	HomeKitBridgeStatusResponseModel,
	HomeKitDeviceCandidateModel,
	HomeKitCandidatesResponseModel,
	HomeKitMapDevicesDto,
	ReqHomeKitMapDevicesDto,
];
