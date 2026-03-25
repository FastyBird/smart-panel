import { Module, OnModuleInit } from '@nestjs/common';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';

import { UpdatePlatformConfigDto } from './dto/update-config.dto';
import { PlatformConfigModel } from './models/config.model';
import { PLATFORM_MODULE_NAME } from './platform.constants';
import { PlatformService } from './services/platform.service';

@Module({
	providers: [PlatformService],
	exports: [PlatformService],
})
export class PlatformModule implements OnModuleInit {
	constructor(
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit(): void {
		this.modulesMapperService.registerMapping<PlatformConfigModel, UpdatePlatformConfigDto>({
			type: PLATFORM_MODULE_NAME,
			class: PlatformConfigModel,
			configDto: UpdatePlatformConfigDto,
		});

		this.extensionsService.registerModuleMetadata({
			type: PLATFORM_MODULE_NAME,
			name: 'Platform',
			description: 'Hardware platform detection, system power actions, and device monitoring',
			author: 'FastyBird',
			readme: `# Platform Module

The Platform module handles hardware detection and platform-specific system operations.

## Features

- **Platform Detection** - Auto-detects Raspberry Pi (including CM4-based boards like reTerminal), Docker, and generic Linux
- **System Power** - Reboot and power off with multi-strategy fallback (systemctl, D-Bus, sudo)
- **Throttle Monitoring** - CPU throttle status on Raspberry Pi (undervoltage, frequency capping, thermal)
- **System Information** - CPU, memory, storage, network stats, and temperature readings
- **Display Control** - Screen brightness and resolution management
- **WiFi Management** - Network scanning and connection

## Supported Platforms

| Platform | Detection | Power Actions | Throttle | Display |
|----------|-----------|---------------|----------|---------|
| Raspberry Pi | Auto (device-tree) | Yes | Yes | Yes |
| reTerminal (CM4) | Auto (device-tree) | Yes | Yes | Yes |
| Docker | Env var | Container restart | No | No |
| Home Assistant | Env var | Addon restart | No | No |
| Generic Linux | Fallback | Limited | No | No |
| Development | Env var | Process exit | No | No |
`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs/plugins/devices-module/reterminal',
				repository: 'https://github.com/FastyBird/smart-panel',
				homepage: 'https://smart-panel.fastybird.com',
			},
		});
	}
}
