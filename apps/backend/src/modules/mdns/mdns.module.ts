import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { MdnsService } from './services/mdns.service';

@Module({
	imports: [NestConfigModule],
	providers: [MdnsService],
	exports: [MdnsService],
})
export class MdnsModule {}
