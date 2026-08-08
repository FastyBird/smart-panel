import { NotFoundException } from '@nestjs/common';

export class McpEndpointDisabledException extends NotFoundException {
	constructor() {
		super('MCP endpoint is disabled');
	}
}
