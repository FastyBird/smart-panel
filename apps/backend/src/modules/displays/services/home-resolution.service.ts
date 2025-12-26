import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { PageEntity } from '../../dashboard/entities/dashboard.entity';
import { PAGES_SPACE_TYPE } from '../../../plugins/pages-space/pages-space.constants';
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
	 * Gets all pages visible to a specific display.
	 * A page is visible if:
	 * - Its displays array is empty (visible to all), OR
	 * - The display ID is in the displays array
	 */
	private async getVisiblePages(displayId: string): Promise<PageEntity[]> {
		// Get all pages with their display assignments
		const allPages = await this.pagesRepository
			.createQueryBuilder('page')
			.leftJoinAndSelect('page.displays', 'displays')
			.orderBy('page.order', 'ASC')
			.addOrderBy('page.createdAt', 'ASC')
			.getMany();

		// Filter to pages visible to this display
		return allPages.filter((page) => {
			// Empty displays array means visible to all
			if (!page.displays || page.displays.length === 0) {
				return true;
			}
			// Check if this display is in the page's displays
			return page.displays.some((d) => d.id === displayId);
		});
	}

	/**
	 * Finds a SpacePage for the given space ID among visible pages.
	 */
	private async findSpacePageForSpace(spaceId: string, visiblePages: PageEntity[]): Promise<PageEntity | null> {
		// Query for SpacePage entities that match the spaceId
		// We need to query the actual SpacePageEntity to get the spaceId field
		const spacePageIds = await this.dataSource.query(
			`SELECT id FROM dashboard_module_pages WHERE type = ? AND spaceId = ?`,
			[PAGES_SPACE_TYPE, spaceId],
		);

		if (!spacePageIds || spacePageIds.length === 0) {
			return null;
		}

		const spacePageIdSet = new Set(spacePageIds.map((row: { id: string }) => row.id));

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
