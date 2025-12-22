import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { DisplaysController } from './controllers/displays.controller';
import { RegistrationController } from './controllers/registration.controller';
import {
	DISPLAYS_MODULE_API_TAG_DESCRIPTION,
	DISPLAYS_MODULE_API_TAG_NAME,
	DISPLAYS_MODULE_NAME,
	DisplayStatusInfluxDbSchema,
} from './displays.constants';
import { DISPLAYS_SWAGGER_EXTRA_MODELS } from './displays.openapi';
import { UpdateDisplaysConfigDto } from './dto/update-config.dto';
import { DisplayEntity } from './entities/displays.entity';
import { RegistrationGuard } from './guards/registration.guard';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { DisplaysConfigModel } from './models/config.model';
import { DisplayConnectionStateService } from './services/display-connection-state.service';
import { DisplaysService } from './services/displays.service';
import { DisplaysModuleResetService } from './services/module-reset.service';
import { PermitJoinService } from './services/permit-join.service';
import { RegistrationService } from './services/registration.service';
import { DisplayEntitySubscriber } from './subscribers/display-entity.subscriber';
import { DisplayExistsConstraint } from './validators/display-exists-constraint.validator';

@ApiTag({
	tagName: DISPLAYS_MODULE_NAME,
	displayName: DISPLAYS_MODULE_API_TAG_NAME,
	description: DISPLAYS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([DisplayEntity]),
		AuthModule,
		ConfigModule,
		ExtensionsModule,
		forwardRef(() => SystemModule),
		forwardRef(() => InfluxDbModule),
	],
	controllers: [DisplaysController, RegistrationController],
	providers: [
		DisplaysService,
		RegistrationService,
		DisplaysModuleResetService,
		DisplayExistsConstraint,
		PermitJoinService,
		RegistrationGuard,
		DisplayConnectionStateService,
		DisplayEntitySubscriber,
		WebsocketExchangeListener,
	],
	exports: [DisplaysService, DisplaysModuleResetService, DisplayExistsConstraint, PermitJoinService],
})
export class DisplaysModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: DisplaysModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly influxDbService: InfluxDbService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.influxDbService.registerSchema(DisplayStatusInfluxDbSchema);

		this.modulesMapperService.registerMapping<DisplaysConfigModel, UpdateDisplaysConfigDto>({
			type: DISPLAYS_MODULE_NAME,
			class: DisplaysConfigModel,
			configDto: UpdateDisplaysConfigDto,
		});

		this.factoryResetRegistry.register(
			DISPLAYS_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				await this.moduleReset.reset();
				return { success: true };
			},
			250, // Priority - display tokens should be revoked before users but after pages
		);

		for (const model of DISPLAYS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: DISPLAYS_MODULE_NAME,
			name: 'Displays',
			description: 'Manage connected display panels and their registration',
			author: 'FastyBird',
			readme: `# Displays Module

The Displays module manages physical display panels connected to the Smart Panel system.

## Features

- **Display Registration** - Secure pairing of display panels with the backend
- **Connection Tracking** - Monitor display online/offline status
- **Multi-Display Support** - Manage multiple display panels from one backend
- **Status History** - Track connection status over time via InfluxDB

## Registration Flow

1. **Permit Join** - Admin enables registration mode in the admin panel
2. **Display Request** - The display sends a registration request with its details
3. **Approval** - Admin approves the display in the pending list
4. **Token Exchange** - Display receives authentication tokens for API access

## Display Properties

- **Name** - Friendly name for the display
- **Identifier** - Unique device identifier
- **Brightness** - Current display brightness level
- **Dark Mode** - Enable/disable dark theme
- **Screen Lock** - PIN protection settings

## WebSocket Events

Displays communicate via WebSocket for real-time updates:
- Configuration changes
- Dashboard updates
- Device state changes`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
