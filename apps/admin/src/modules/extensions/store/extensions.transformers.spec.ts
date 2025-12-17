import { describe, expect, it } from 'vitest';

import { ExtensionKind } from '../extensions.constants';

import type { IExtensionRes } from './extensions.store.types';
import { transformExtensionResponse, transformExtensionUpdateRequest } from './extensions.transformers';

describe('Extensions Transformers', () => {
	describe('transformExtensionResponse', () => {
		it('should transform module response correctly', () => {
			const response: IExtensionRes = {
				type: 'devices-module',
				kind: 'module',
				name: 'Devices Module',
				description: 'Manage devices',
				version: '1.0.0',
				author: 'FastyBird',
				enabled: true,
				is_core: true,
				can_toggle_enabled: false,
				links: {
					documentation: 'https://docs.example.com',
					dev_documentation: 'https://dev.example.com',
					bugs_tracking: 'https://bugs.example.com',
					repository: 'https://github.com/example',
					homepage: 'https://example.com',
				},
			};

			const result = transformExtensionResponse(response);

			expect(result.type).toBe('devices-module');
			expect(result.kind).toBe(ExtensionKind.MODULE);
			expect(result.name).toBe('Devices Module');
			expect(result.description).toBe('Manage devices');
			expect(result.version).toBe('1.0.0');
			expect(result.author).toBe('FastyBird');
			expect(result.enabled).toBe(true);
			expect(result.isCore).toBe(true);
			expect(result.canToggleEnabled).toBe(false);
			expect(result.links).toEqual({
				documentation: 'https://docs.example.com',
				devDocumentation: 'https://dev.example.com',
				bugsTracking: 'https://bugs.example.com',
				repository: 'https://github.com/example',
				homepage: 'https://example.com',
			});
		});

		it('should transform plugin response correctly', () => {
			const response: IExtensionRes = {
				type: 'pages-tiles-plugin',
				kind: 'plugin',
				name: 'Pages Tiles Plugin',
				enabled: true,
				is_core: true,
				can_toggle_enabled: true,
			};

			const result = transformExtensionResponse(response);

			expect(result.type).toBe('pages-tiles-plugin');
			expect(result.kind).toBe(ExtensionKind.PLUGIN);
			expect(result.name).toBe('Pages Tiles Plugin');
			expect(result.enabled).toBe(true);
			expect(result.isCore).toBe(true);
			expect(result.canToggleEnabled).toBe(true);
			expect(result.links).toBeUndefined();
		});

		it('should handle optional fields', () => {
			const response: IExtensionRes = {
				type: 'test-module',
				kind: 'module',
				name: 'Test Module',
				enabled: false,
				is_core: false,
				can_toggle_enabled: true,
			};

			const result = transformExtensionResponse(response);

			expect(result.description).toBeUndefined();
			expect(result.version).toBeUndefined();
			expect(result.author).toBeUndefined();
			expect(result.links).toBeUndefined();
		});

		it('should handle partial links', () => {
			const response: IExtensionRes = {
				type: 'test-plugin',
				kind: 'plugin',
				name: 'Test Plugin',
				enabled: true,
				is_core: false,
				can_toggle_enabled: true,
				links: {
					documentation: 'https://docs.example.com',
				},
			};

			const result = transformExtensionResponse(response);

			expect(result.links?.documentation).toBe('https://docs.example.com');
			expect(result.links?.devDocumentation).toBeUndefined();
			expect(result.links?.bugsTracking).toBeUndefined();
			expect(result.links?.repository).toBeUndefined();
			expect(result.links?.homepage).toBeUndefined();
		});
	});

	describe('transformExtensionUpdateRequest', () => {
		it('should transform enabled true request', () => {
			const result = transformExtensionUpdateRequest({ enabled: true });

			expect(result).toEqual({ enabled: true });
		});

		it('should transform enabled false request', () => {
			const result = transformExtensionUpdateRequest({ enabled: false });

			expect(result).toEqual({ enabled: false });
		});
	});
});
