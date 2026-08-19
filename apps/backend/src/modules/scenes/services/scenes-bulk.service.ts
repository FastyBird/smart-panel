import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { SCENES_MODULE_NAME } from '../scenes.constants';

import { ScenesService } from './scenes.service';

/**
 * Runs a scene operation across a selection in a single request.
 *
 * The per-scene semantics, including each refusal, are meant to be identical to
 * the single-scene endpoints - see runBulkOperation for why the work is still
 * performed one scene at a time.
 */
@Injectable()
export class ScenesBulkService {
	private readonly logger = createExtensionLogger(SCENES_MODULE_NAME, 'ScenesBulkService');

	constructor(private readonly scenesService: ScenesService) {}

	async remove(ids: string[]): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			// The service raises for a missing or non-deletable scene with a reason
			// worth reading, and runBulkOperation carries that through per item.
			(id) => this.scenesService.remove(id),
			'Scene could not be removed',
		);

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}

	async setEnabled(ids: string[], enabled: boolean): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			async (id) => {
				await this.scenesService.update(id, { enabled });
			},
			'Scene could not be updated',
		);

		this.logger.debug(
			`Bulk enabled=${String(enabled)} finished succeeded=${result.succeeded.length} failed=${result.failed.length}`,
		);

		return result;
	}
}
