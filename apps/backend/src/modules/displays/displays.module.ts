import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { PageEntity } from '../dashboard/entities/dashboard.entity';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SpaceEntity } from '../spaces/entities/space.entity';
import { SpacesModule } from '../spaces/spaces.module';
import { StorageService } from '../storage/services/storage.service';
import { StorageModule } from '../storage/storage.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import { DisplaysController } from './controllers/displays.controller';
import { RegistrationController } from './controllers/registration.controller';
import {
	DISPLAYS_MODULE_API_TAG_DESCRIPTION,
	DISPLAYS_MODULE_API_TAG_NAME,
	DISPLAYS_MODULE_NAME,
	DisplayStatusStorageSchema,
} from './displays.constants';
import { DISPLAYS_SWAGGER_EXTRA_MODELS } from './displays.openapi';
import { UpdateDisplaysConfigDto } from './dto/update-config.dto';
import { DisplayEntity } from './entities/displays.entity';
import { RegistrationGuard } from './guards/registration.guard';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { DisplaysConfigModel } from './models/config.model';
import { DisplayConnectionStateService } from './services/display-connection-state.service';
import { DisplaysService } from './services/displays.service';
import { HomeResolutionService } from './services/home-resolution.service';
import { DisplaysModuleResetService } from './services/module-reset.service';
import { PermitJoinService } from './services/permit-join.service';
import { RegistrationService } from './services/registration.service';
import { SpaceHomePageResolverRegistryService } from './services/space-home-page-resolver-registry.service';
import { SpaceSelectionValidatorRegistryService } from './services/space-selection-validator-registry.service';
import { DisplayEntitySubscriber } from './subscribers/display-entity.subscriber';
import { DisplayExistsConstraint } from './validators/display-exists-constraint.validator';

@ApiTag({
	tagName: DISPLAYS_MODULE_NAME,
	displayName: DISPLAYS_MODULE_API_TAG_NAME,
	description: DISPLAYS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([DisplayEntity, PageEntity, SpaceEntity]),
		AuthModule,
		StorageModule,
		SpacesModule,
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
		HomeResolutionService,
		SpaceHomePageResolverRegistryService,
		SpaceSelectionValidatorRegistryService,
	],
	exports: [
		DisplaysService,
		DisplaysModuleResetService,
		DisplayExistsConstraint,
		PermitJoinService,
		HomeResolutionService,
		SpaceHomePageResolverRegistryService,
		SpaceSelectionValidatorRegistryService,
	],
})
export class DisplaysModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: DisplaysModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly storageService: StorageService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.storageService.registerSchema(DisplayStatusStorageSchema);

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
			readme: `# Displays

> Module · by FastyBird

Manages physical display panels (the Flutter touchscreen app) connected to the Smart Panel backend. Owns pairing, per-display configuration, the home-page resolution that decides what each panel shows on boot, and real-time updates that keep every screen in sync without any user-side credentials.

## Features

- **Secure pairing (permit-join)** — registration is closed by default; an admin opens a temporary join window from the admin UI, the panel submits its hardware fingerprint, and the admin approves it before any token is issued
- **Per-display credentials** — once approved, the panel is given a long-lived token tied to its display ID; pulling the display from the admin UI revokes the token immediately
- **Multi-display** — drive any number of panels from one backend, each with its own primary space, brightness and personalisation
- **Per-display configuration** — brightness, dark / auto mode, optional PIN lock, idle / screensaver behaviour, primary space and home page; all editable from the admin UI and pushed live to the panel
- **Home-page resolution** — pluggable resolvers decide which dashboard page a display should land on for a given space; space plugins can register their own logic without touching this module
- **Space-selection validation** — pluggable validators ensure a display can only be tied to spaces it's actually allowed to render
- **Connection tracking** — display online / offline state and last-seen timestamps are stored as time-series and exposed to the stats module
- **WebSocket exchange** — listens to backend events (dashboards, devices, scenes, weather, …) and re-broadcasts only the slices each display needs
- **Factory reset hook** — registers itself with the system reset pipeline so wiping a panel removes its display record and revokes its token

## Registration Flow

1. **Permit join** — an admin enables registration mode in the admin UI for a limited time window
2. **Display request** — the panel sends its identifier and metadata to the registration endpoint
3. **Approval** — the admin reviews the pending registration and either approves or rejects it
4. **Token exchange** — on approval, the panel receives long-lived credentials for API and WebSocket access; permit-join then closes again

## API Endpoints

- \`GET|PATCH|DELETE /api/v1/modules/displays/displays\` — list, configure and remove displays
- \`POST /api/v1/modules/displays/registration\` — submit a registration request (panel side)
- \`PATCH /api/v1/modules/displays/registration/permit\` — toggle permit-join (admin side)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
