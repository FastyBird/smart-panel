import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ModuleConfigMutationRegistryService } from '../config/services/module-config-mutation-registry.service';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../extensions/services/managed-service-manager.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import {
	CAMERAS_MODULE_API_TAG_DESCRIPTION,
	CAMERAS_MODULE_API_TAG_NAME,
	CAMERAS_MODULE_NAME,
} from './cameras.constants';
import { CAMERAS_SWAGGER_EXTRA_MODELS } from './cameras.openapi';
import { CamerasLiveController } from './controllers/cameras-live.controller';
import { CamerasStatusController } from './controllers/cameras-status.controller';
import { CamerasController } from './controllers/cameras.controller';
import { UpdateCamerasConfigDto } from './dto/update-config.dto';
import { LiveStreamGateway } from './gateway/live-stream.gateway';
import { LiveUpgradeRequiredHook } from './gateway/live-upgrade-required.hook';
import { CamerasConfigModel } from './models/config.model';
import { CameraSessionService } from './services/camera-session.service';
import { CameraSnapshotService } from './services/camera-snapshot.service';
import { CameraStreamProviderRegistryService } from './services/camera-stream-provider.registry.service';
import { CamerasConfigMutationService } from './services/cameras-config-mutation.service';
import { CamerasService } from './services/cameras.service';
import { Go2rtcProcessService } from './services/go2rtc-process.service';
import { Go2rtcSecretsRegistry } from './services/go2rtc-secrets.registry';
import { Go2rtcStreamsService } from './services/go2rtc-streams.service';
import { Go2rtcService } from './services/go2rtc.service';

@ApiTag({
	tagName: CAMERAS_MODULE_NAME,
	displayName: CAMERAS_MODULE_API_TAG_NAME,
	description: CAMERAS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [NestConfigModule, DevicesModule, SwaggerModule],
	providers: [
		CameraStreamProviderRegistryService,
		CamerasService,
		CameraSnapshotService,
		CameraSessionService,
		CamerasConfigMutationService,
		Go2rtcSecretsRegistry,
		Go2rtcProcessService,
		Go2rtcService,
		Go2rtcStreamsService,
		LiveStreamGateway,
		LiveUpgradeRequiredHook,
	],
	controllers: [CamerasController, CamerasStatusController, CamerasLiveController],
	exports: [
		CameraStreamProviderRegistryService,
		CamerasService,
		CameraSnapshotService,
		CameraSessionService,
		Go2rtcService,
		Go2rtcStreamsService,
	],
})
export class CamerasModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
		private readonly moduleConfigMutations: ModuleConfigMutationRegistryService,
		private readonly configMutation: CamerasConfigMutationService,
		private readonly managedServiceManager: ManagedServiceManagerService,
		private readonly go2rtcService: Go2rtcService,
	) {}

	onModuleInit() {
		this.managedServiceManager.register(this.go2rtcService);

		// Register configuration mapping
		this.modulesMapperService.registerMapping<CamerasConfigModel, UpdateCamerasConfigDto>({
			type: CAMERAS_MODULE_NAME,
			class: CamerasConfigModel,
			configDto: UpdateCamerasConfigDto,
		});

		this.moduleConfigMutations.register<UpdateCamerasConfigDto>(CAMERAS_MODULE_NAME, (update, commit) =>
			this.configMutation.update(update, commit),
		);

		// Register Swagger models
		for (const model of CAMERAS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata for this module
		this.extensionsService.registerModuleMetadata({
			type: CAMERAS_MODULE_NAME,
			name: 'Cameras',
			description: 'Camera listing, snapshots and live view sessions for camera devices',
			author: 'FastyBird',
			readme: `# Cameras

> Module · by FastyBird

Live view and snapshots for camera and doorbell devices. Integrations plug in a stream provider; this module lists the cameras, hands out snapshots and opens short-lived live view sessions.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
