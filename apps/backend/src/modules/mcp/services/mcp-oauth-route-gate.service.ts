import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { McpOAuthReadinessService } from './mcp-oauth-readiness.service';

@Injectable()
export class McpOAuthRouteGateService {
	private open = false;

	constructor(private readonly readiness: McpOAuthReadinessService) {}

	openInternal(): void {
		this.readiness.assertReady();
		this.open = true;
	}

	closeInternal(): void {
		this.open = false;
	}

	assertOpen(): void {
		if (!this.open) {
			throw new ServiceUnavailableException('The MCP OAuth route gate is closed');
		}

		this.readiness.assertReady();
	}

	get isOpen(): boolean {
		return this.open && this.readiness.snapshot.ready;
	}
}
