import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { McpOAuthReadinessService } from './mcp-oauth-readiness.service';

@Injectable()
export class McpOAuthRouteGateService {
	private open = false;
	private generation = 0;

	constructor(private readonly readiness: McpOAuthReadinessService) {}

	openInternal(): void {
		this.readiness.assertReady();
		this.open = true;
	}

	closeInternal(): void {
		this.open = false;
		this.generation += 1;
	}

	assertOpen(): number {
		if (!this.open) {
			throw new ServiceUnavailableException('The MCP OAuth route gate is closed');
		}

		this.readiness.assertReady();

		return this.generation;
	}

	assertOpenGeneration(generation: number): void {
		if (this.assertOpen() !== generation) {
			throw new ServiceUnavailableException('The MCP OAuth route gate changed while the request was queued');
		}
	}

	get isOpen(): boolean {
		return this.open && this.readiness.snapshot.ready;
	}
}
