import { Injectable } from '@nestjs/common';

import { IRemoteAccessProvider } from '../platforms/remote-access-provider.platform';
import { RemoteAccessProviderAlreadyRegisteredException } from '../remote-access.exceptions';

/**
 * In-memory registry of remote-access provider plugins. Providers register
 * themselves in their own `onModuleInit` through `register()`; the module
 * never shells out and never knows a provider's binary.
 */
@Injectable()
export class RemoteAccessProviderRegistryService {
	private readonly providers = new Map<string, IRemoteAccessProvider>();

	register(provider: IRemoteAccessProvider): void {
		if (this.providers.has(provider.type)) {
			throw new RemoteAccessProviderAlreadyRegisteredException(
				`Remote access provider '${provider.type}' is already registered.`,
			);
		}

		this.providers.set(provider.type, provider);
	}

	getAll(): IRemoteAccessProvider[] {
		return Array.from(this.providers.values());
	}

	get(type: string): IRemoteAccessProvider | null {
		return this.providers.get(type) ?? null;
	}
}
