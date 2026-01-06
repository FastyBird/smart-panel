import { Module, forwardRef } from '@nestjs/common';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';

import { UpdateIntentsConfigDto } from './dto/update-config.dto';
import { INTENTS_MODULE_NAME } from './intents.constants';
import { IntentsConfigModel } from './models/config.model';
import { IntentsService } from './services/intents.service';

@Module({
	imports: [forwardRef(() => ExtensionsModule)],
	providers: [IntentsService],
	exports: [IntentsService],
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
			readme: `# Intents Module

The Intents module provides intent orchestration for coordinating UI updates across multiple clients, preventing anti-jitter issues and enabling optimistic updates.

## Features

- **Intent Lifecycle Management** - Track intents from creation through completion or expiration
- **Multi-Target Support** - Single intent can affect multiple devices/properties
- **Optimistic Updates** - Clients can show expected values before confirmation
- **Anti-Jitter Protection** - Prevents UI flickering when multiple clients update simultaneously
- **WebSocket Integration** - Real-time intent status broadcasts to all connected clients

## How It Works

1. **Intent Creation** - When a client initiates an action (e.g., turn on light), an intent is created with a unique ID and TTL
2. **Broadcasting** - The intent is broadcast to all connected clients via WebSocket
3. **Target Tracking** - Each target (device/property) within the intent is tracked individually
4. **Completion** - When backend confirms the change, intent is marked complete
5. **Expiration** - If TTL expires before confirmation, intent is marked expired

## Intent Types

- \`light.toggle\` - Toggle light on/off
- \`light.setBrightness\` - Set light brightness level
- \`light.setColor\` - Set light RGB color
- \`light.setColorTemp\` - Set light color temperature
- \`device.setProperty\` - Generic property value change
- \`scene.run\` - Execute a scene

## Client Integration

Clients should:
1. Listen for intent events via WebSocket
2. Apply optimistic updates when intent is created
3. Revert if intent expires or fails
4. Confirm when intent completes successfully`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
