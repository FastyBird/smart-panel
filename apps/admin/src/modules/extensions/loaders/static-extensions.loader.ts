import type { App } from 'vue';

import type { ConsolaInstance } from 'consola';

import type { AdminExtension } from '@root-config/extensions';

import type { IExtensionOptions } from '../../../app.types';

export const installStaticExtensions = (
	app: App,
	logger: ConsolaInstance,
	options: IExtensionOptions,
	installedNames: Set<string>,
	list: AdminExtension[]
): void => {
	for (const ext of list) {
		if (installedNames.has(ext.name)) {
			continue;
		}

		const mod = ext.module as { install?: (app: App, options?: IExtensionOptions) => void } | ((app: App, options?: IExtensionOptions) => void);

		if (typeof mod === 'function') {
			mod(app, options);
			installedNames.add(ext.name);

			continue;
		}

		if (mod && typeof mod.install === 'function') {
			mod.install(app, options);
			installedNames.add(ext.name);

			continue;
		}

		logger.error(`Static extension ${ext.name} is not a valid Vue plugin export.`);
	}
};
