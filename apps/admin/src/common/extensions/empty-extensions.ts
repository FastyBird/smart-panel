import type { App } from 'vue';

export interface AdminExtension<TOptions = unknown> {
	name: string;
	module: { install(app: App, options?: TOptions): void } | ((app: App, options?: TOptions) => void);
	kind: 'module' | 'plugin';
}

export const extensions: AdminExtension[] = [];
