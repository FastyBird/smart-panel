import { Module } from '@nestjs/common';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { StorageModule } from '../storage/storage.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';

import { IntentsController } from './controllers/intents.controller';
import { UpdateIntentsConfigDto } from './dto/update-config.dto';
import {
	INTENTS_MODULE_API_TAG_DESCRIPTION,
	INTENTS_MODULE_API_TAG_NAME,
	INTENTS_MODULE_NAME,
} from './intents.constants';
import { IntentsConfigModel } from './models/config.model';
import { IntentTimeseriesService } from './services/intent-timeseries.service';
import { IntentsService } from './services/intents.service';

@ApiTag({
	tagName: INTENTS_MODULE_NAME,
	displayName: INTENTS_MODULE_API_TAG_NAME,
	description: INTENTS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [StorageModule],
	controllers: [IntentsController],
	providers: [IntentsService, IntentTimeseriesService],
	exports: [IntentsService, IntentTimeseriesService],
})
export class IntentsModule {
	constructor(
		private readonly extensionsService: ExtensionsService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	onModuleInit() {
		// Register configuration mapping
		this.modulesMapperService.registerMapping<IntentsConfigModel, UpdateIntentsConfigDto>({
			type: INTENTS_MODULE_NAME,
			class: IntentsConfigModel,
			configDto: UpdateIntentsConfigDto,
		});

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: INTENTS_MODULE_NAME,
			name: 'Intents',
			description: 'Intent orchestration for UI anti-jitter and optimistic updates',
			author: 'FastyBird',
			readme: `# Intents

> Module · by FastyBird

Coordinates UI updates across all connected clients (admin, panel displays, mobile) so optimistic actions stay in sync. An intent represents a user-initiated change with a TTL: clients show the expected value immediately and reconcile when the backend confirms the real outcome or the TTL elapses. This is what makes the panel feel instant even when the underlying device takes a second to respond.

## What it gives you

- A "single source of truth" for in-flight user actions: every client sees the same pending change at the same time
- Automatic anti-jitter — when two users tap the same switch from two clients, they don't fight each other
- A short audit trail of recent user actions, queryable by the action observer used in dashboards and Buddy

## Features

- **Intent lifecycle** — \`pending → confirmed | failed | expired\`, observable through the API and over WebSocket
- **Multi-target** — a single intent can carry several device / property writes at once and is committed atomically from the UI's point of view
- **Optimistic updates** — clients apply the expected value the instant the intent is created and revert if the backend reports failure or the TTL fires
- **Anti-jitter** — coalesces near-simultaneous intents on the same target so the UI doesn't flicker between competing values
- **WebSocket broadcast** — every state transition is pushed to every connected client; no polling needed
- **Time-series log** — completed and failed intents are persisted briefly so dashboards and the assistant can answer "what just happened in this room?"
- **Pluggable intent types** — modules can register their own intent kinds with their own validation and reconciliation logic

## Intent Types

- \`light.toggle\` — toggle a light on/off
- \`light.setBrightness\` — set light brightness
- \`light.setColor\` — set light RGB colour
- \`light.setColorTemp\` — set light colour temperature
- \`device.setProperty\` — generic property value change
- \`scene.run\` — execute a scene

## Client Flow

1. User triggers an action — a client publishes an intent
2. The intent is broadcast over WebSocket; every client applies the expected value
3. The backend confirms the change → intent completes and clients keep the value
4. If the TTL elapses without confirmation → intent expires and clients revert to the last known good value`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
