import { CreateProtectChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateProtectChannelDto } from './dto/create-channel.dto';
import { CreateProtectDeviceChannelPropertyDto } from './dto/create-device-channel-property.dto';
import { CreateProtectDeviceChannelDto } from './dto/create-device-channel.dto';
import { CreateProtectDeviceDto } from './dto/create-device.dto';
import {
	ProtectAdoptDeviceDto,
	ProtectAdoptStreamDto,
	ProtectBatchAdoptDevicesDto,
	ProtectReqAdoptDeviceDto,
	ProtectReqBatchAdoptDevicesDto,
} from './dto/protect-adoption.dto';
import { ProtectProbeDto, ProtectProbeRequestDto } from './dto/protect-discovery-probe.dto';
import { ProtectMappingPreviewDto, ProtectReqMappingPreviewDto } from './dto/protect-mapping-preview.dto';
import {
	ProtectTestCandidateConnectionDto,
	ProtectTestConnectionDto,
	ProtectTestConnectionRequestDto,
	ProtectTestSavedConnectionDto,
	ProtectTestTlsDto,
} from './dto/test-connection.dto';
import { UpdateProtectChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateProtectChannelDto } from './dto/update-channel.dto';
import { ProtectUpdatePluginConfigDto, ProtectUpdateTlsConfigDto } from './dto/update-config.dto';
import { UpdateProtectDeviceDto } from './dto/update-device.dto';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from './entities/devices-unifi-protect.entity';
import { ProtectConfigModel, ProtectTlsConfigModel } from './models/config.model';
import {
	ProtectAdoptionResponseModel,
	ProtectAdoptionResultModel,
	ProtectAdoptionStreamModel,
	ProtectBatchAdoptionModel,
	ProtectBatchAdoptionResponseModel,
} from './models/protect-adoption.model';
import {
	ProtectDiscoveredConsoleModel,
	ProtectDiscoveryInterfaceModel,
	ProtectDiscoveryModel,
	ProtectDiscoveryResponseModel,
	ProtectProbeCertificateModel,
	ProtectProbeModel,
	ProtectProbeResponseModel,
} from './models/protect-discovery.model';
import {
	ProtectInventoryDeviceModel,
	ProtectInventoryDeviceResponseModel,
	ProtectInventoryDevicesResponseModel,
} from './models/protect-inventory.model';
import {
	ProtectMappingPreviewChannelModel,
	ProtectMappingPreviewDeviceModel,
	ProtectMappingPreviewModel,
	ProtectMappingPreviewPropertyModel,
	ProtectMappingPreviewResponseModel,
	ProtectMappingPreviewStreamModel,
	ProtectMappingPreviewWarningModel,
} from './models/protect-mapping-preview.model';
import { ProtectStatusModel, ProtectStatusResponseModel } from './models/status.model';
import {
	ProtectCertificateModel,
	ProtectTestConnectionModel,
	ProtectTestConnectionResponseModel,
} from './models/test-connection.model';

export const DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS = [
	ProtectTlsConfigModel,
	ProtectConfigModel,
	ProtectUpdateTlsConfigDto,
	ProtectUpdatePluginConfigDto,
	ProtectDeviceEntity,
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	CreateProtectDeviceDto,
	CreateProtectDeviceChannelDto,
	CreateProtectDeviceChannelPropertyDto,
	UpdateProtectDeviceDto,
	CreateProtectChannelDto,
	UpdateProtectChannelDto,
	CreateProtectChannelPropertyDto,
	UpdateProtectChannelPropertyDto,
	ProtectStatusModel,
	ProtectStatusResponseModel,
	ProtectTestConnectionDto,
	ProtectTestSavedConnectionDto,
	ProtectTestTlsDto,
	ProtectTestCandidateConnectionDto,
	ProtectTestConnectionRequestDto,
	ProtectCertificateModel,
	ProtectTestConnectionModel,
	ProtectTestConnectionResponseModel,
	ProtectDiscoveryInterfaceModel,
	ProtectProbeCertificateModel,
	ProtectProbeModel,
	ProtectDiscoveredConsoleModel,
	ProtectDiscoveryModel,
	ProtectDiscoveryResponseModel,
	ProtectProbeResponseModel,
	ProtectProbeDto,
	ProtectProbeRequestDto,
	ProtectInventoryDeviceModel,
	ProtectInventoryDevicesResponseModel,
	ProtectInventoryDeviceResponseModel,
	ProtectMappingPreviewDto,
	ProtectReqMappingPreviewDto,
	ProtectMappingPreviewDeviceModel,
	ProtectMappingPreviewPropertyModel,
	ProtectMappingPreviewChannelModel,
	ProtectMappingPreviewWarningModel,
	ProtectMappingPreviewStreamModel,
	ProtectMappingPreviewModel,
	ProtectMappingPreviewResponseModel,
	ProtectAdoptStreamDto,
	ProtectAdoptDeviceDto,
	ProtectReqAdoptDeviceDto,
	ProtectBatchAdoptDevicesDto,
	ProtectReqBatchAdoptDevicesDto,
	ProtectAdoptionResultModel,
	ProtectAdoptionStreamModel,
	ProtectBatchAdoptionModel,
	ProtectAdoptionResponseModel,
	ProtectBatchAdoptionResponseModel,
];
