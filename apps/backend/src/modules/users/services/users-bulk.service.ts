import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { USERS_MODULE_NAME, UserRole } from '../users.constants';

import { UsersService } from './users.service';

/**
 * Runs a user operation across a selection in a single request.
 *
 * The per-user semantics, including each refusal, are meant to be identical to
 * the single-user endpoints - see runBulkOperation for why the work is still
 * performed one user at a time.
 */
@Injectable()
export class UsersBulkService {
	private readonly logger = createExtensionLogger(USERS_MODULE_NAME, 'UsersBulkService');

	constructor(private readonly usersService: UsersService) {}

	/**
	 * @param authenticatedUserId Who is asking. The single delete endpoint refuses
	 *   to remove the caller's own account, so the caller has to travel with the
	 *   selection for that rule to survive the move to bulk.
	 */
	async remove(ids: string[], authenticatedUserId: string | null): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			async (id) => {
				// The service raises for a missing user with a reason worth reading, and
				// the account is needed anyway for the two refusals the single delete
				// endpoint enforces - going through bulk must not be a way around them.
				const user = await this.usersService.getOneOrThrow(id);

				if (authenticatedUserId !== null && authenticatedUserId === user.id) {
					throw new Error('You cannot delete your own account');
				}

				if (user.role === UserRole.OWNER) {
					throw new Error('The owner account cannot be deleted');
				}

				await this.usersService.remove(user.id);
			},
			'User could not be removed',
		);

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}
}
