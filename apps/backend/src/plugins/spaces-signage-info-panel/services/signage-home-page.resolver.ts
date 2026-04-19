import { Injectable } from '@nestjs/common';

import { ISpaceHomePageResolver } from '../../../modules/displays/services/space-home-page-resolver-registry.service';

/**
 * Home-page resolver for signage info-panel spaces.
 *
 * Signage is a read-only surface — the panel's `spaceViewBuilders` dispatch
 * renders the info-panel view directly, bypassing dashboard pages entirely.
 * Registering a resolver (even one that returns `null`) makes the plugin's
 * ownership of the `signage_info_panel` space type visible in the registry
 * and prevents the home-resolution service from silently hitting its
 * "no resolver found, use first page" fallback path.
 */
@Injectable()
export class SignageHomePageResolver implements ISpaceHomePageResolver {
	resolve(): string | null {
		return null;
	}
}
