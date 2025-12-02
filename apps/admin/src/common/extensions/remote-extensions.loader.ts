import type { App } from 'vue';

import type { ConsolaInstance } from 'consola';
import type { Client } from 'openapi-fetch';

import type { IExtensionOptions } from '../../app.types';
import { SYSTEM_MODULE_PREFIX } from '../../modules/system';
import { type operations, type paths } from '../../openapi.constants';
import { SystemModuleExtensionSurface, SystemModuleQuerySurface } from '../../openapi.constants';
import { getErrorReason } from '../utils/api-error.utils';

type PluginInstallFn<TOptions> = (app: App, options?: TOptions) => void;

interface PluginObject<TOptions> {
	install: PluginInstallFn<TOptions>;
}

type PluginLike<TOptions> = PluginInstallFn<TOptions> | PluginObject<TOptions>;

const isExtensionObject = <TOptions>(val: unknown): val is PluginObject<TOptions> => {
	return typeof val === 'object' && val !== null && 'install' in val && typeof (val as { install: unknown }).install === 'function';
};

const isExtensionFn = <TOptions>(val: unknown): val is PluginInstallFn<TOptions> => {
	return typeof val === 'function';
};

const resolveExtension = <TOptions>(mod: unknown): PluginLike<TOptions> | null => {
	const candidate = (mod as { default?: unknown })?.default ?? mod;

	if (isExtensionObject<TOptions>(candidate)) {
		return candidate;
	}

	if (isExtensionFn<TOptions>(candidate)) {
		return candidate;
	}

	return null;
};

export const installRemoteExtensions = async (
	app: App,
	backendClient: Client<paths>,
	logger: ConsolaInstance,
	options: IExtensionOptions,
	installedNames?: Set<string>
): Promise<void> => {
	const {
		data: responseData,
		error,
		response,
	} = await backendClient.GET(`/${SYSTEM_MODULE_PREFIX}/extensions`, {
		params: {
			query: {
				surface: SystemModuleQuerySurface.admin,
			},
		},
	});

	if (responseData && Array.isArray(responseData.data)) {
		const entries = responseData.data;

		for (const ext of entries) {
			if (ext.surface !== SystemModuleExtensionSurface.admin) {
				continue;
			}

			try {
				// tell Vite to leave this alone at build time
				const remoteUrl = 'remote_url' in ext ? ext.remote_url : undefined;
				if (!remoteUrl) {
					continue;
				}
				const mod: unknown = await import(/* @vite-ignore */ remoteUrl);

				const extension = resolveExtension<IExtensionOptions>(mod);

				if (extension) {
					if (installedNames?.has(ext.name)) {
						continue;
					}

					if (isExtensionFn<IExtensionOptions>(extension)) {
						extension(app, options);
					} else {
						extension.install(app, options);
					}

					installedNames?.add(ext.name);
				} else {
					logger.error(`The ${ext.name} is not a valid Vue plugin export.`);
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);

				const remoteUrl = 'remote_url' in ext ? ext.remote_url : 'unknown';
				logger.error(`Failed to import ${ext.name} from ${remoteUrl}: ${msg}`);
			}
		}

		return;
	}

	let errorReason: string | null = 'Failed to fetch extensions assets.';

	if (error) {
		errorReason = getErrorReason<operations['get-system-module-extensions']>(error, errorReason);
	}

	logger.error(`${errorReason}${response?.status ? ` (HTTP ${response.status})` : ''}`);
};
