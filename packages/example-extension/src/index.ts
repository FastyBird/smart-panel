import { Module } from '@nestjs/common';
import { ExampleController } from './example.controller.js';

@Module({
	controllers: [ExampleController],
})
export class ExampleExtensionModule {}
