import { describe, expect, it } from 'vitest';

import { ExtensionKind, ExtensionSource, ExtensionSurface } from '../extensions.constants';
import { ExtensionsValidationException } from '../extensions.exceptions';

import type { IDiscoveredExtensionRes } from './discovered-extensions.store.types';
import { transformDiscoveredExtensionResponse } from './discovered-extensions.transformers';

describe('Discovered Extensions Transformers', () => {
	describe('transformDiscoveredExtensionResponse', () => {
		it('should transform admin extension response correctly', () => {
			const response: IDiscoveredExtensionRes = {
				name: 'test-module',
				kind: ExtensionKind.MODULE,
				surface: ExtensionSurface.ADMIN,
				display_name: 'Test Module',
				description: 'A test module',
				version: '1.0.0',
				source: ExtensionSource.BUNDLED,
				remote_url: 'http://localhost:3000',
				type: 'admin',
			};

			const result = transformDiscoveredExtensionResponse(response);

			expect(result.name).toBe('test-module');
			expect(result.kind).toBe(ExtensionKind.MODULE);
			expect(result.surface).toBe(ExtensionSurface.ADMIN);
			expect(result.displayName).toBe('Test Module');
			expect(result.description).toBe('A test module');
			expect(result.version).toBe('1.0.0');
			expect(result.source).toBe(ExtensionSource.BUNDLED);
			expect((result as { remoteUrl: string }).remoteUrl).toBe('http://localhost:3000');
		});

		it('should transform backend extension response correctly', () => {
			const response: IDiscoveredExtensionRes = {
				name: 'test-plugin',
				kind: ExtensionKind.PLUGIN,
				surface: ExtensionSurface.BACKEND,
				display_name: 'Test Plugin',
				description: 'A test plugin',
				version: '2.0.0',
				source: ExtensionSource.RUNTIME,
				route_prefix: '/api/v1/test-plugin',
				type: 'backend',
			};

			const result = transformDiscoveredExtensionResponse(response);

			expect(result.name).toBe('test-plugin');
			expect(result.kind).toBe(ExtensionKind.PLUGIN);
			expect(result.surface).toBe(ExtensionSurface.BACKEND);
			expect(result.displayName).toBe('Test Plugin');
			expect(result.description).toBe('A test plugin');
			expect(result.version).toBe('2.0.0');
			expect(result.source).toBe(ExtensionSource.RUNTIME);
			expect((result as { routePrefix: string }).routePrefix).toBe('/api/v1/test-plugin');
		});

		it('should handle null description', () => {
			const response: IDiscoveredExtensionRes = {
				name: 'test-module',
				kind: ExtensionKind.MODULE,
				surface: ExtensionSurface.ADMIN,
				display_name: 'Test Module',
				description: null,
				version: null,
				source: ExtensionSource.BUNDLED,
				remote_url: 'http://localhost:3000',
				type: 'admin',
			};

			const result = transformDiscoveredExtensionResponse(response);

			expect(result.description).toBeNull();
			expect(result.version).toBeNull();
		});

		it('should throw ExtensionsValidationException for invalid data', () => {
			const invalidResponse = {
				name: 'test-module',
				// Missing required fields
			} as IDiscoveredExtensionRes;

			expect(() => transformDiscoveredExtensionResponse(invalidResponse)).toThrow(ExtensionsValidationException);
		});
	});
});
