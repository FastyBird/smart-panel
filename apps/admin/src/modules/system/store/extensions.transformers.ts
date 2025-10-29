import { SystemValidationException } from '../system.exceptions';

import { ExtensionSchema } from './extensions.store.schemas';
import type { IExtension, IExtensionRes } from './extensions.store.types';

export const transformExtensionResponse = (response: IExtensionRes): IExtension => {
	const parsedExtension = ExtensionSchema.safeParse({
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
		throw new SystemValidationException('Failed to validate received log entry data.');
	}

	return parsedExtension.data;
};
