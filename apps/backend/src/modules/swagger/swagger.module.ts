import { Module } from '@nestjs/common';

import { SwaggerService } from './services/swagger.service';

@Module({
	providers: [SwaggerService],
	exports: [SwaggerService],
})
export class SwaggerModule {}
