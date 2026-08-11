import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import {
	McpOAuthProviderFactory,
	McpOAuthProviderFactoryOptions,
	McpOAuthProviderRuntime,
} from '../oauth/mcp-oauth-provider.factory';

import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';

@Injectable()
export class McpOAuthRuntimeService {
	private runtime: McpOAuthProviderRuntime | null = null;
	private activation: Promise<McpOAuthProviderRuntime> | null = null;

	constructor(
		private readonly providerFactory: McpOAuthProviderFactory,
		private readonly routeGate: McpOAuthRouteGateService,
	) {}

	async activateInternal(options: McpOAuthProviderFactoryOptions = {}): Promise<McpOAuthProviderRuntime> {
		if (this.runtime) return this.runtime;
		this.activation ??= this.providerFactory.create(options);

		try {
			this.runtime = await this.activation;
			return this.runtime;
		} finally {
			this.activation = null;
		}
	}

	getActive(): McpOAuthProviderRuntime {
		this.routeGate.assertOpen();

		if (!this.runtime) {
			throw new ServiceUnavailableException('The internal MCP OAuth route gate is closed');
		}

		return this.runtime;
	}

	deactivateInternal(): void {
		this.runtime = null;
	}
}
