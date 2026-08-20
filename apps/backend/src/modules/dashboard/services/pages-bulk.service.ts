import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';

import { PagesService } from './pages.service';

/**
 * Runs a page operation across a selection in a single request.
 *
 * The per-page semantics, including each refusal, are meant to be identical to
 * the single-page endpoints - see runBulkOperation for why the work is still
 * performed one page at a time.
 */
@Injectable()
export class PagesBulkService {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'PagesBulkService');

	constructor(private readonly pagesService: PagesService) {}

	async remove(ids: string[]): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			// The service raises for a missing page with a reason worth reading, and
			// runBulkOperation carries that through per item.
			(id) => this.pagesService.remove(id),
			{ fallbackReason: 'Page could not be removed', safeErrors: [DashboardException], logger: this.logger },
		);

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}
}
