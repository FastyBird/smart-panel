import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { DISPLAYS_MODULE_NAME, HomeMode } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

import { SpaceHomePageResolverRegistryService } from './space-home-page-resolver-registry.service';

export interface ResolvedHomePage {
	pageId: string | null;
	resolutionMode: 'explicit' | 'auto_space' | 'fallback';
	reason: string;
}

@Injectable()
export class HomeResolutionService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'HomeResolutionService');

	constructor(
		@InjectRepository(PageEntity)
		private readonly pagesRepository: Repository<PageEntity>,
		@InjectRepository(SpaceEntity)
		private readonly spacesRepository: Repository<SpaceEntity>,
		private readonly resolverRegistry: SpaceHomePageResolverRegistryService,
	) {}

	/**
	 * Resolves the home page for a display based on its configuration.
	 *
	 * Resolution precedence:
	 * 1. If homeMode is 'explicit' and homePageId is set and page exists -> use it
	 * 2. If homeMode is 'auto_space' and the display has a spaceId, ask the
	 *    plugin that owns the space's type for its home page (if any).
	 * 3. Final fallback -> first page or null
	 */
	async resolveHomePage(display: DisplayEntity): Promise<ResolvedHomePage> {
		this.logger.debug(`Resolving home page for display id=${display.id}, homeMode=${display.homeMode}`);

		const visiblePages = await this.getVisiblePages(display.id);
		const space = await this.loadDisplaySpace(display);

		return this.resolveHomePageWithPages(display, visiblePages, space);
	}

	/**
	 * Resolves home pages for multiple displays in a single batch operation.
	 * This avoids N+1 queries by fetching all pages once and reusing them.
	 */
	async resolveHomePagesBatch(displays: DisplayEntity[]): Promise<Map<string, ResolvedHomePage>> {
		if (displays.length === 0) {
			return new Map();
		}

		const allPages = await this.getAllPagesWithDisplays();

		const spaceIds = [...new Set(displays.map((d) => d.spaceId).filter((id): id is string => !!id))];
		const spacesById = new Map<string, SpaceEntity>();

		if (spaceIds.length > 0) {
			const spaces = await this.spacesRepository.createQueryBuilder('space').whereInIds(spaceIds).getMany();
			for (const space of spaces) {
				spacesById.set(space.id, space);
			}
		}

		const results = new Map<string, ResolvedHomePage>();
		for (const display of displays) {
			const visiblePages = this.filterVisiblePages(allPages, display.id);
			const space = display.spaceId ? (spacesById.get(display.spaceId) ?? null) : null;
			const resolved = await this.resolveHomePageWithPages(display, visiblePages, space);
			results.set(display.id, resolved);
		}

		return results;
	}

	/**
	 * Internal resolution logic that works with pre-fetched pages.
	 */
	private async resolveHomePageWithPages(
		display: DisplayEntity,
		visiblePages: PageEntity[],
		space: SpaceEntity | null,
	): Promise<ResolvedHomePage> {
		if (visiblePages.length === 0) {
			this.logger.debug(`No pages visible to display id=${display.id}`);
			return {
				pageId: null,
				resolutionMode: 'fallback',
				reason: 'No pages are assigned to or visible for this display',
			};
		}

		// 1. Explicit mode - use configured home page
		if (display.homeMode === HomeMode.EXPLICIT && display.homePageId) {
			const explicitPage = visiblePages.find((p) => p.id === display.homePageId);
			if (explicitPage) {
				this.logger.debug(`Using explicit home page id=${display.homePageId}`);
				return {
					pageId: display.homePageId,
					resolutionMode: 'explicit',
					reason: 'Using explicitly configured home page',
				};
			}
			this.logger.warn(`Explicit home page id=${display.homePageId} not found or not visible, falling back`);
		}

		// 2. Auto-space mode - ask the plugin that owns the space type
		if (display.homeMode === HomeMode.AUTO_SPACE && space) {
			const resolver = this.resolverRegistry.getResolverFor(space.type);
			if (resolver) {
				const resolvedPageId = await resolver.resolve(space);
				if (resolvedPageId) {
					const autoPage = visiblePages.find((p) => p.id === resolvedPageId);
					if (autoPage) {
						this.logger.debug(`Auto-space resolver for type=${space.type} returned pageId=${resolvedPageId}`);
						return {
							pageId: resolvedPageId,
							resolutionMode: 'auto_space',
							reason: `Auto-space resolver for space type "${space.type}" resolved home page`,
						};
					}
					this.logger.warn(
						`Auto-space resolver for type=${space.type} returned pageId=${resolvedPageId} but it is not visible to display`,
					);
				}
			}
		}

		// 3. Fallback - use first visible page by order
		const firstPage = this.getFirstPage(visiblePages);
		if (firstPage) {
			this.logger.debug(`Using first page id=${firstPage.id} as fallback`);
			return {
				pageId: firstPage.id,
				resolutionMode: 'fallback',
				reason: 'Fallback to first assigned page',
			};
		}

		// 4. No pages available
		return {
			pageId: null,
			resolutionMode: 'fallback',
			reason: 'No pages available',
		};
	}

	/**
	 * Gets all pages with their display assignments (for batch operations).
	 */
	private async getAllPagesWithDisplays(): Promise<PageEntity[]> {
		return this.pagesRepository
			.createQueryBuilder('page')
			.leftJoinAndSelect('page.displays', 'displays')
			.orderBy('page.order', 'ASC')
			.addOrderBy('page.createdAt', 'ASC')
			.getMany();
	}

	/**
	 * Filters pages to those visible to a specific display.
	 */
	private filterVisiblePages(allPages: PageEntity[], displayId: string): PageEntity[] {
		return allPages.filter((page) => {
			if (!page.displays || page.displays.length === 0) {
				return true;
			}
			return page.displays.some((d) => d.id === displayId);
		});
	}

	/**
	 * Gets all pages visible to a specific display.
	 * A page is visible if:
	 * - Its displays array is empty (visible to all), OR
	 * - The display ID is in the displays array
	 */
	private async getVisiblePages(displayId: string): Promise<PageEntity[]> {
		const allPages = await this.getAllPagesWithDisplays();
		return this.filterVisiblePages(allPages, displayId);
	}

	/**
	 * Gets the first page by order, then by creation date.
	 */
	private getFirstPage(pages: PageEntity[]): PageEntity | null {
		if (pages.length === 0) {
			return null;
		}
		// Pages are already sorted by order and createdAt from the query
		return pages[0];
	}

	/**
	 * Loads the space entity a display is assigned to, or returns null if
	 * unassigned. Prefers an already-hydrated `display.space` relation to
	 * avoid an extra query.
	 */
	private async loadDisplaySpace(display: DisplayEntity): Promise<SpaceEntity | null> {
		if (!display.spaceId) {
			return null;
		}

		if (display.space) {
			return display.space;
		}

		return this.spacesRepository.findOne({ where: { id: display.spaceId } });
	}
}
