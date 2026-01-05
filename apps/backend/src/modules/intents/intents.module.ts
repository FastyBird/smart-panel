import { Module } from '@nestjs/common';

import { IntentsService } from './services/intents.service';

@Module({
	imports: [],
	providers: [IntentsService],
	exports: [IntentsService],
})
export class IntentsModule {}
