import { Controller, Get } from '@nestjs/common';

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
