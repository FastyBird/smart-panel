import { Injectable } from '@nestjs/common';

import { SpaceEntity } from '../../spaces/entities/space.entity';

/**
 * Resolver contract contributed by plugins that own a space type.
 *
 * When a display's `homeMode` is `auto_space`, the home resolver asks
 * the plugin that owns the display's assigned space to decide which
 * dashboard page (if any) is the home page for that space. Plugins
 * that represent read-only surfaces (e.g. signage) return `null` so
 * the panel knows there is no home page and skips dashboard chrome.
 */
export interface ISpaceHomePageResolver {
	resolve(space: SpaceEntity): Promise<string | null> | string | null;
}

@Injectable()
export class SpaceHomePageResolverRegistryService {
	private readonly resolvers = new Map<string, ISpaceHomePageResolver>();

	register(spaceType: string, resolver: ISpaceHomePageResolver): void {
		this.resolvers.set(spaceType, resolver);
	}

	getResolverFor(spaceType: string): ISpaceHomePageResolver | undefined {
		return this.resolvers.get(spaceType);
	}
}
