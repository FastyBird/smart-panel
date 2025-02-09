import { Module } from '@nestjs/common';

import { PlatformService } from './services/platform.service';

@Module({
	providers: [PlatformService],
	exports: [PlatformService],
})
export class PlatformModule {}
