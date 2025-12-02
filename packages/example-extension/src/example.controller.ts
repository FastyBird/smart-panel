import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class ExampleController {
	@Get('status')
	getStatus() {
		return {
			name: 'Example Extension',
			ok: true,
			timestamp: new Date().toISOString(),
		};
	}
}
