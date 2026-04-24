import { Injectable } from '@nestjs/common';

import { ISpaceHomePageResolver } from '../../../modules/displays/services/space-home-page-resolver-registry.service';

/**
 * Home-control resolver for auto-space home-page resolution.
 *
 * Today, rooms and zones do not have a "dedicated page" concept in the
 * database — the panel falls back to the first visible dashboard page.
 * This resolver therefore returns `null`, which makes the home-resolution
 * service fall through to its first-page fallback. Future work can wire a
 * per-space preferred-page column here without touching core.
 */
@Injectable()
export class HomeControlHomePageResolver implements ISpaceHomePageResolver {
	resolve(): string | null {
		return null;
	}
}
