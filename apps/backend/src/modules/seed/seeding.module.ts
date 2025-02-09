import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { SeedCommand } from './commands/seeding.command';
import { SeedService, SeedTools } from './services/seed.service';

@Module({
	imports: [NestConfigModule],
	providers: [SeedService, SeedTools, SeedCommand],
	exports: [SeedService, SeedTools],
})
export class SeedModule {}
