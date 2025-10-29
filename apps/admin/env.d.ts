/// <reference types="vite/client" />

// Build-time injected globals (see vite.config.ts -> define)
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

declare module '@root-config/extensions' {
	import type { App } from 'vue';

	export interface AdminExtension<TOptions = unknown> {
		name: string;
		module: { install(app: App, options?: TOptions): void } | ((app: App, options?: TOptions) => void);
		kind: 'module' | 'plugin';
	}

	// The generator will overwrite this at build time; the stub just declares it
	export const extensions: AdminExtension[];
}
