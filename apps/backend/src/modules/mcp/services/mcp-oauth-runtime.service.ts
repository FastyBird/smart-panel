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
	private activation: { generation: number; promise: Promise<McpOAuthProviderRuntime> } | null = null;
	private activationGeneration = 0;

	constructor(
		private readonly providerFactory: McpOAuthProviderFactory,
		private readonly routeGate: McpOAuthRouteGateService,
	) {}

	async activateInternal(options: McpOAuthProviderFactoryOptions = {}): Promise<McpOAuthProviderRuntime> {
		if (this.runtime) return this.runtime;
		const activation =
			this.activation?.generation === this.activationGeneration
				? this.activation
				: { generation: this.activationGeneration, promise: this.providerFactory.create(options) };
		this.activation = activation;

		try {
			const runtime = await activation.promise;

			if (activation.generation !== this.activationGeneration) {
				throw new ServiceUnavailableException('MCP OAuth provider activation was cancelled');
			}

			this.runtime = runtime;
			return runtime;
		} finally {
			if (this.activation === activation) this.activation = null;
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
		this.activationGeneration += 1;
		this.runtime = null;
	}
}
