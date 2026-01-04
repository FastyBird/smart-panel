import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { PAGES_HOUSE_MODES_TYPE } from '../../../plugins/pages-house-modes/pages-house-modes.constants';
import { PAGES_HOUSE_TYPE } from '../../../plugins/pages-house/pages-house.constants';
import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { DISPLAYS_MODULE_NAME, DisplayRole, HomeMode } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

export interface ResolvedHomePage {
	pageId: string | null;
	resolutionMode: 'explicit' | 'auto_role' | 'fallback';
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
	 * 2. If role is 'master' and a House Overview page exists -> use it
	 * 3. If role is 'entry' and a House Modes page exists -> use it
	 * 4. Final fallback -> first page or null
	 */
	async resolveHomePage(display: DisplayEntity): Promise<ResolvedHomePage> {
		this.logger.debug(
			`Resolving home page for display id=${display.id}, role=${display.role}, homeMode=${display.homeMode}`,
		);

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

		// Fetch all pages once with their display assignments
		const allPages = await this.getAllPagesWithDisplays();

		// Determine which page types we need to look up
		let needsHouseOverview = false;
		let needsHouseModes = false;
		for (const display of displays) {
			// Master role needs House Overview page lookup
			if (display.role === DisplayRole.MASTER) {
				needsHouseOverview = true;
			}
			// Entry role needs House Modes page lookup
			if (display.role === DisplayRole.ENTRY) {
				needsHouseModes = true;
			}
		}

		// Batch fetch all House Overview page IDs if needed
		let houseOverviewPageIds: Set<string> = new Set();
		if (needsHouseOverview) {
			houseOverviewPageIds = await this.getHouseOverviewPageIds();
		}

		// Batch fetch all House Modes page IDs if needed
		let houseModesPageIds: Set<string> = new Set();
		if (needsHouseModes) {
			houseModesPageIds = await this.getHouseModesPageIds();
		}

		// Resolve for each display using cached data
		const results = new Map<string, ResolvedHomePage>();
		for (const display of displays) {
			const visiblePages = this.filterVisiblePages(allPages, display.id);
			const resolved = this.resolveHomePageWithPagesAndCache(
				display,
				visiblePages,
				houseOverviewPageIds,
				houseModesPageIds,
			);
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

		// 1. Explicit mode - use configured home page (highest priority, overrides role)
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

		// 2. Role-based resolution
		// 2a. Master role - find House Overview page
		if (display.role === DisplayRole.MASTER) {
			const houseOverviewPageId = await this.findHouseOverviewPageId(visiblePages);
			if (houseOverviewPageId) {
				this.logger.debug(`Using House Overview page id=${houseOverviewPageId} for master role`);
				return {
					pageId: houseOverviewPageId,
					resolutionMode: 'auto_role',
					reason: 'Using House Overview page (master role)',
				};
			}
			this.logger.debug(`No House Overview page found for master role`);
		}

		// 2b. Entry role - find House Modes page
		if (display.role === DisplayRole.ENTRY) {
			const houseModesPageId = await this.findHouseModesPageId(visiblePages);
			if (houseModesPageId) {
				this.logger.debug(`Using House Modes page id=${houseModesPageId} for entry role`);
				return {
					pageId: houseModesPageId,
					resolutionMode: 'auto_role',
					reason: 'Using House Modes page (entry role)',
				};
			}
			this.logger.debug(`No House Modes page found for entry role`);
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
	 * Internal resolution logic for batch operations with pre-fetched page type caches.
	 */
	private resolveHomePageWithPagesAndCache(
		display: DisplayEntity,
		visiblePages: PageEntity[],
		houseOverviewPageIds: Set<string>,
		houseModesPageIds: Set<string>,
	): ResolvedHomePage {
		if (visiblePages.length === 0) {
			return {
				pageId: null,
				resolutionMode: 'fallback',
				reason: 'No pages are assigned to or visible for this display',
			};
		}

		// 1. Explicit mode - use configured home page (highest priority, overrides role)
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

		// 2. Role-based resolution
		// 2a. Master role - find House Overview page (first visible one)
		if (display.role === DisplayRole.MASTER && houseOverviewPageIds.size > 0) {
			const houseOverviewPage = visiblePages.find((p) => houseOverviewPageIds.has(p.id));
			if (houseOverviewPage) {
				return {
					pageId: houseOverviewPage.id,
					resolutionMode: 'auto_role',
					reason: 'Using House Overview page (master role)',
				};
			}
		}

		// 2b. Entry role - find House Modes page (first visible one)
		if (display.role === DisplayRole.ENTRY && houseModesPageIds.size > 0) {
			const houseModesPage = visiblePages.find((p) => houseModesPageIds.has(p.id));
			if (houseModesPage) {
				return {
					pageId: houseModesPage.id,
					resolutionMode: 'auto_role',
					reason: 'Using House Modes page (entry role)',
				};
			}
		}

		// 3. Fallback - use first visible page by order
		const firstPage = this.getFirstPage(visiblePages);
		if (firstPage) {
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
	 * Finds a House Overview page ID among visible pages.
	 * Returns the first matching house overview page.
	 */
	private async findHouseOverviewPageId(visiblePages: PageEntity[]): Promise<string | null> {
		// Query for House Overview page entities
		const housePageIds: { id: string }[] = await this.dataSource.query(
			`SELECT id FROM dashboard_module_pages WHERE type = ?`,
			[PAGES_HOUSE_TYPE],
		);

		if (!housePageIds || housePageIds.length === 0) {
			return null;
		}

		const housePageIdSet = new Set(housePageIds.map((row) => row.id));

		// Find the first matching house overview page that is visible to this display
		const housePage = visiblePages.find((page) => housePageIdSet.has(page.id));
		return housePage?.id || null;
	}

	/**
	 * Gets all House Overview page IDs (for batch operations).
	 * Returns a Set of page IDs that are house overview pages.
	 * Each display will filter this set to find visible ones.
	 */
	private async getHouseOverviewPageIds(): Promise<Set<string>> {
		const housePageIds: { id: string }[] = await this.dataSource.query(
			`SELECT id FROM dashboard_module_pages WHERE type = ? ORDER BY "order" ASC, "createdAt" ASC`,
			[PAGES_HOUSE_TYPE],
		);

		return new Set(housePageIds.map((row) => row.id));
	}

	/**
	 * Finds a House Modes page ID among visible pages.
	 * Returns the first matching house modes page.
	 */
	private async findHouseModesPageId(visiblePages: PageEntity[]): Promise<string | null> {
		// Query for House Modes page entities
		const houseModesPageIds: { id: string }[] = await this.dataSource.query(
			`SELECT id FROM dashboard_module_pages WHERE type = ?`,
			[PAGES_HOUSE_MODES_TYPE],
		);

		if (!houseModesPageIds || houseModesPageIds.length === 0) {
			return null;
		}

		const houseModesPageIdSet = new Set(houseModesPageIds.map((row) => row.id));

		// Find the first matching house modes page that is visible to this display
		const houseModesPage = visiblePages.find((page) => houseModesPageIdSet.has(page.id));
		return houseModesPage?.id || null;
	}

	/**
	 * Gets all House Modes page IDs (for batch operations).
	 * Returns a Set of page IDs that are house modes pages.
	 * Each display will filter this set to find visible ones.
	 */
	private async getHouseModesPageIds(): Promise<Set<string>> {
		const houseModesPageIds: { id: string }[] = await this.dataSource.query(
			`SELECT id FROM dashboard_module_pages WHERE type = ? ORDER BY "order" ASC, "createdAt" ASC`,
			[PAGES_HOUSE_MODES_TYPE],
		);

		return new Set(houseModesPageIds.map((row) => row.id));
	}
}
