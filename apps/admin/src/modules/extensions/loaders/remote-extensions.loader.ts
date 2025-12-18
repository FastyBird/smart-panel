import type { App } from 'vue';

import type { ConsolaInstance } from 'consola';
import type { Client } from 'openapi-fetch';

import { MODULES_PREFIX } from '../../../app.constants';
import type { IExtensionOptions } from '../../../app.types';
import type { OpenApiPaths } from '../../../openapi.constants';
import { getErrorReason } from '../../../common/utils/api-error.utils';
import { EXTENSIONS_MODULE_PREFIX, ExtensionSurface } from '../extensions.constants';

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
	backendClient: Client<OpenApiPaths>,
	logger: ConsolaInstance,
	options: IExtensionOptions,
	installedNames?: Set<string>
): Promise<void> => {
	const {
		data: responseData,
		error,
		response,
	} = await backendClient.GET(`/${MODULES_PREFIX}/${EXTENSIONS_MODULE_PREFIX}/discovered` as `/${string}`, {
		params: {
			query: {
				surface: ExtensionSurface.ADMIN,
			},
		},
	});

	if (responseData && Array.isArray((responseData as { data: unknown[] }).data)) {
		const entries = (responseData as { data: Array<{ name: string; surface: string; remote_url?: string }> }).data;

		for (const ext of entries) {
			if (ext.surface !== ExtensionSurface.ADMIN) {
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
		errorReason = getErrorReason(error, errorReason);
	}

	logger.error(`${errorReason}${response?.status ? ` (HTTP ${response.status})` : ''}`);
};
