import { ExtensionKind } from '../extensions.constants';

import type { IExtension, IExtensionRes } from './extensions.store.types';

export const transformExtensionResponse = (response: IExtensionRes): IExtension => {
	// Use app version for core extensions that don't have a specific version
	const version = response.version ?? (response.is_core ? __APP_VERSION__ : undefined);

	return {
		type: response.type,
		kind: response.kind === 'module' ? ExtensionKind.MODULE : ExtensionKind.PLUGIN,
		name: response.name,
		description: response.description,
		version,
		author: response.author,
		readme: response.readme,
		docs: response.docs,
		enabled: response.enabled,
		isCore: response.is_core,
		canToggleEnabled: response.can_toggle_enabled,
		links: response.links
			? {
					documentation: response.links.documentation,
					devDocumentation: response.links.dev_documentation,
					bugsTracking: response.links.bugs_tracking,
					repository: response.links.repository,
					homepage: response.links.homepage,
				}
			: undefined,
	};
};

export const transformExtensionUpdateRequest = (data: { enabled: boolean }): { enabled: boolean } => {
	return {
		enabled: data.enabled,
	};
};
