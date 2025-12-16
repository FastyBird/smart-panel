import { ExtensionsValidationException } from '../extensions.exceptions';

import { DiscoveredExtensionSchema } from './discovered-extensions.store.schemas';
import type { IDiscoveredExtension, IDiscoveredExtensionRes } from './discovered-extensions.store.types';

export const transformDiscoveredExtensionResponse = (response: IDiscoveredExtensionRes): IDiscoveredExtension => {
	const parsedExtension = DiscoveredExtensionSchema.safeParse({
		name: response.name,
		kind: response.kind,
		surface: response.surface,
		displayName: response.display_name,
		description: response.description,
		version: response.version,
		source: response.source,
		routePrefix: 'route_prefix' in response ? response['route_prefix'] : undefined,
		remoteUrl: 'remote_url' in response ? response['remote_url'] : undefined,
	});

	if (!parsedExtension.success) {
		throw new ExtensionsValidationException('Failed to validate received discovered extension data.');
	}

	return parsedExtension.data;
};
