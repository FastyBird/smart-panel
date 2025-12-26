import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { PAGES_SPACE_TYPE } from '../../../plugins/pages-space/pages-space.constants';
import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { DISPLAYS_MODULE_NAME, HomeMode } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

export interface ResolvedHomePage {
	pageId: string | null;
	resolutionMode: 'explicit' | 'auto_space' | 'first_page' | 'fallback';
	reason: string;
}

@Injectable()
export class HomeResolutionService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'HomeResolutionService');

	constructor(
		@InjectRepository(PageEntity)
		private readonly pagesRepository: Repository<PageEntity>,
		private readonly dataSource: DataSource,
	) {}

	/**
	 * Resolves the home page for a display based on its configuration.
	 *
	 * Resolution precedence:
	 * 1. If homeMode is 'explicit' and homePageId is set and page exists -> use it
	 * 2. If homeMode is 'auto_space' and display has spaceId and a SpacePage exists for that space -> use it
	 * 3. If homeMode is 'first_page' or fallback -> use first assigned page (by order)
	 * 4. Final fallback -> null (no pages available)
	 */
	async resolveHomePage(display: DisplayEntity): Promise<ResolvedHomePage> {
		this.logger.debug(`Resolving home page for display id=${display.id}, homeMode=${display.homeMode}`);

		// Get pages visible to this display (empty displays array means visible to all)
		const visiblePages = await this.getVisiblePages(display.id);

		return this.resolveHomePageWithPages(display, visiblePages);
	}

	/**
	 * Resolves home pages for multiple displays in a single batch operation.
	 * This avoids N+1 queries by fetching all pages once and reusing them.
	 */
	async resolveHomePagesBatch(displays: DisplayEntity[]): Promise<Map<string, ResolvedHomePage>> {
		if (displays.length === 0) {
			return new Map();
		}

		this.logger.debug(`Batch resolving home pages for ${displays.length} displays`);

		// Fetch all pages once with their display assignments
		const allPages = await this.getAllPagesWithDisplays();

		// Get all unique space IDs that need SpacePage lookup
		const spaceIds = new Set<string>();
		for (const display of displays) {
			if (display.homeMode === HomeMode.AUTO_SPACE && display.spaceId) {
				spaceIds.add(display.spaceId);
			}
		}

		// Batch fetch all SpacePage mappings
		const spacePageMap = await this.getSpacePagesForSpaces(Array.from(spaceIds));

		// Resolve for each display using cached data
		const results = new Map<string, ResolvedHomePage>();
		for (const display of displays) {
			const visiblePages = this.filterVisiblePages(allPages, display.id);
			const resolved = this.resolveHomePageWithPagesAndSpaceMap(display, visiblePages, spacePageMap);
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

		// 2. Auto-space mode - find SpacePage for display's space
		if (display.homeMode === HomeMode.AUTO_SPACE && display.spaceId) {
			const spacePage = await this.findSpacePageForSpace(display.spaceId, visiblePages);
			if (spacePage) {
				this.logger.debug(`Using auto-space home page id=${spacePage.id} for space id=${display.spaceId}`);
				return {
					pageId: spacePage.id,
					resolutionMode: 'auto_space',
					reason: `Using SpacePage for space ${display.spaceId}`,
				};
			}
			this.logger.debug(`No SpacePage found for space id=${display.spaceId}, falling back to first page`);
		}

		// 3. First page mode or fallback - use first visible page by order
		const firstPage = this.getFirstPage(visiblePages);
		if (firstPage) {
			const mode = display.homeMode === HomeMode.FIRST_PAGE ? 'first_page' : 'fallback';
			this.logger.debug(`Using first page id=${firstPage.id} as home (mode=${mode})`);
			return {
				pageId: firstPage.id,
				resolutionMode: mode,
				reason: mode === 'first_page' ? 'Using first assigned page' : 'Fallback to first assigned page',
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
	 * Internal resolution logic for batch operations with pre-fetched space page map.
	 */
	private resolveHomePageWithPagesAndSpaceMap(
		display: DisplayEntity,
		visiblePages: PageEntity[],
		spacePageMap: Map<string, string>,
	): ResolvedHomePage {
		if (visiblePages.length === 0) {
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
				return {
					pageId: display.homePageId,
					resolutionMode: 'explicit',
					reason: 'Using explicitly configured home page',
				};
			}
		}

		// 2. Auto-space mode - find SpacePage for display's space using pre-fetched map
		if (display.homeMode === HomeMode.AUTO_SPACE && display.spaceId) {
			const spacePageId = spacePageMap.get(display.spaceId);
			if (spacePageId) {
				const spacePage = visiblePages.find((p) => p.id === spacePageId);
				if (spacePage) {
					return {
						pageId: spacePage.id,
						resolutionMode: 'auto_space',
						reason: `Using SpacePage for space ${display.spaceId}`,
					};
				}
			}
		}

		// 3. First page mode or fallback - use first visible page by order
		const firstPage = this.getFirstPage(visiblePages);
		if (firstPage) {
			const mode = display.homeMode === HomeMode.FIRST_PAGE ? 'first_page' : 'fallback';
			return {
				pageId: firstPage.id,
				resolutionMode: mode,
				reason: mode === 'first_page' ? 'Using first assigned page' : 'Fallback to first assigned page',
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
	 * Batch fetches SpacePage IDs for multiple space IDs.
	 * Returns a map of spaceId -> pageId.
	 */
	private async getSpacePagesForSpaces(spaceIds: string[]): Promise<Map<string, string>> {
		if (spaceIds.length === 0) {
			return new Map();
		}

		const placeholders = spaceIds.map(() => '?').join(', ');
		const spacePages: { id: string; spaceId: string }[] = await this.dataSource.query(
			`SELECT id, spaceId FROM dashboard_module_pages WHERE type = ? AND spaceId IN (${placeholders})`,
			[PAGES_SPACE_TYPE, ...spaceIds],
		);

		const result = new Map<string, string>();
		for (const row of spacePages) {
			// Only keep the first SpacePage per space (if there are multiple)
			if (!result.has(row.spaceId)) {
				result.set(row.spaceId, row.id);
			}
		}

		return result;
	}

	/**
	 * Finds a SpacePage for the given space ID among visible pages.
	 */
	private async findSpacePageForSpace(spaceId: string, visiblePages: PageEntity[]): Promise<PageEntity | null> {
		// Query for SpacePage entities that match the spaceId
		// We need to query the actual SpacePageEntity to get the spaceId field
		const spacePageIds: { id: string }[] = await this.dataSource.query(
			`SELECT id FROM dashboard_module_pages WHERE type = ? AND spaceId = ?`,
			[PAGES_SPACE_TYPE, spaceId],
		);

		if (!spacePageIds || spacePageIds.length === 0) {
			return null;
		}

		const spacePageIdSet = new Set(spacePageIds.map((row) => row.id));

		// Find the first matching space page that is visible to this display
		return visiblePages.find((page) => spacePageIdSet.has(page.id)) || null;
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
}
