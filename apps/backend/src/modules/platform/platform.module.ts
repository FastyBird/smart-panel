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
			readme: `# Platform

> Module · by FastyBird

Auto-detects the underlying hardware / runtime and abstracts platform-specific system operations behind a uniform API. Other modules ask "reboot the device" or "set brightness to 50%" — this module decides whether that means \`systemctl\`, a Docker restart, a sysfs poke or a no-op.

## What it gives you

- A consistent abstraction so the rest of the codebase never branches on "are we on a Pi or in Docker?"
- Multi-strategy fallback — when the preferred mechanism (systemctl, D-Bus, sudo) is unavailable the module tries the next best option before giving up
- A safe sandbox for development where destructive actions become harmless equivalents (e.g. process exit instead of OS reboot)

## Features

- **Auto-detection** — Raspberry Pi (incl. CM4 boards like reTerminal), Docker, Home Assistant add-on or generic Linux; a single env override lets you force any platform for testing
- **Power actions** — reboot and power off with multi-strategy fallback (systemctl, D-Bus, sudo, container restart)
- **Throttle monitoring** — CPU under-voltage, frequency capping and thermal flags on Raspberry Pi, exposed to the system module so the panel can warn the user
- **System information** — CPU, memory, storage, network and temperature readings polled in the background and cached
- **Display control** — screen brightness, screen blanking and resolution management on supported boards
- **Wi-Fi management** — scan visible networks and connect to a chosen SSID with passphrase
- **Time / locale** — timezone read and update where supported by the host

## Supported Platforms

| Platform | Detection | Power | Throttle | Display | Wi-Fi |
|----------|-----------|-------|----------|---------|-------|
| Raspberry Pi | device-tree | yes | yes | yes | yes |
| reTerminal (CM4) | device-tree | yes | yes | yes | yes |
| Docker | env var | container restart | no | no | no |
| Home Assistant | env var | add-on restart | no | no | no |
| Generic Linux | fallback | limited | no | limited | limited |
| Development | env var | process exit | no | no | no |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs/plugins/devices-module/reterminal',
				repository: 'https://github.com/FastyBird/smart-panel',
				homepage: 'https://smart-panel.fastybird.com',
			},
		});
	}
}
