import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { SPACES_MODULE_NAME } from '../spaces.constants';

import { SpacesService } from './spaces.service';

/**
 * Removes a selection of spaces in a single request.
 *
 * The per-space semantics, including each refusal, are meant to be identical to
 * the single-space endpoint - see runBulkOperation for why the work is still
 * performed one space at a time.
 */
@Injectable()
export class SpacesBulkService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesBulkService');

	constructor(private readonly spacesService: SpacesService) {}

	async remove(ids: string[]): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			// The service raises for a missing space with a reason worth reading, and
			// runBulkOperation carries that through per item.
			(id) => this.spacesService.remove(id),
			'Space could not be removed',
		);

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}
}
