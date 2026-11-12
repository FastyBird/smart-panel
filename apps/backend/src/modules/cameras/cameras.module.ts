import { Module, OnModuleInit } from '@nestjs/common';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import {
	CAMERAS_MODULE_API_TAG_DESCRIPTION,
	CAMERAS_MODULE_API_TAG_NAME,
	CAMERAS_MODULE_NAME,
} from './cameras.constants';
import { CAMERAS_SWAGGER_EXTRA_MODELS } from './cameras.openapi';
import { CamerasController } from './controllers/cameras.controller';
import { UpdateCamerasConfigDto } from './dto/update-config.dto';
import { CamerasConfigModel } from './models/config.model';
import { CameraSnapshotService } from './services/camera-snapshot.service';
import { CameraStreamProviderRegistryService } from './services/camera-stream-provider.registry.service';
import { CamerasService } from './services/cameras.service';

@ApiTag({
	tagName: CAMERAS_MODULE_NAME,
	displayName: CAMERAS_MODULE_API_TAG_NAME,
	description: CAMERAS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [DevicesModule, SwaggerModule],
	providers: [CameraStreamProviderRegistryService, CamerasService, CameraSnapshotService],
	controllers: [CamerasController],
	exports: [CameraStreamProviderRegistryService, CamerasService, CameraSnapshotService],
})
export class CamerasModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register configuration mapping
		this.modulesMapperService.registerMapping<CamerasConfigModel, UpdateCamerasConfigDto>({
			type: CAMERAS_MODULE_NAME,
			class: CamerasConfigModel,
			configDto: UpdateCamerasConfigDto,
		});

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
