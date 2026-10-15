import type { DiscoveredBackendExtension } from '@fastybird/smart-panel-extension-sdk';
import { DynamicModule, Global, Module } from '@nestjs/common';

export const DISCOVERED_BACKEND_EXTENSIONS = Symbol('discovered-backend-extensions');

@Global()
@Module({})
export class DiscoveredBackendModule {
	static register(descriptors: readonly DiscoveredBackendExtension[]): DynamicModule {
		return {
			module: DiscoveredBackendModule,
			providers: [
				{
					provide: DISCOVERED_BACKEND_EXTENSIONS,
					useValue: Object.freeze(descriptors.map((descriptor) => Object.freeze({ ...descriptor }))),
				},
			],
			exports: [DISCOVERED_BACKEND_EXTENSIONS],
		};
	}
}
