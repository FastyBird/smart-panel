import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserEntity } from '../../users/entities/users.entity';
import { EventType, UserRole } from '../../users/users.constants';
import { McpOAuthApproverAuthorityService } from '../services/mcp-oauth-approver-authority.service';

@Injectable()
export class McpUsersListener {
	constructor(private readonly approverAuthority: McpOAuthApproverAuthorityService) {}

	@OnEvent(EventType.USER_UPDATED, { suppressErrors: false })
	async onUserUpdated(user: UserEntity, previousRole: UserRole): Promise<void> {
		if ([UserRole.OWNER, UserRole.ADMIN].includes(user.role)) return;
		if (![UserRole.OWNER, UserRole.ADMIN].includes(previousRole)) return;

		await this.approverAuthority.invalidateApprover(user.id);
	}

	@OnEvent(EventType.USER_DELETED, { suppressErrors: false })
	async onUserDeleted(user: UserEntity): Promise<void> {
		await this.approverAuthority.invalidateApprover(user.id);
	}
}
