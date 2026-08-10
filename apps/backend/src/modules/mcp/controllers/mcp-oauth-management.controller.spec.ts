import { v4 as uuid } from 'uuid';

import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { UserRole } from '../../users/users.constants';
import { McpOAuthScope } from '../mcp.constants';
import { McpOAuthGrantModel } from '../models/mcp-oauth-management.model';
import { McpOAuthManagementService } from '../services/mcp-oauth-management.service';

import { McpOAuthManagementController } from './mcp-oauth-management.controller';

describe('McpOAuthManagementController', () => {
	it('forwards an authenticated grant-scope reduction and returns the response envelope', async () => {
		const actorId = uuid();
		const grantId = uuid();
		const dto = { approvedScopes: [McpOAuthScope.READ] };
		const grant = Object.assign(new McpOAuthGrantModel(), { id: grantId, approvedScopes: dto.approvedScopes });
		const updateGrant = jest.fn().mockResolvedValue(grant);
		const controller = new McpOAuthManagementController({ updateGrant } as unknown as McpOAuthManagementService);
		const request = {
			auth: { type: 'user', id: actorId, role: UserRole.ADMIN },
		} as unknown as AuthenticatedRequest;

		const response = await controller.updateGrant(grantId, { data: dto }, request);

		expect(response.data).toBe(grant);
		expect(updateGrant).toHaveBeenCalledWith(grantId, dto, actorId);
	});

	it('forwards a global OAuth revocation for the authenticated administrator', async () => {
		const actorId = uuid();
		const revokeAll = jest.fn().mockResolvedValue(undefined);
		const controller = new McpOAuthManagementController({ revokeAll } as unknown as McpOAuthManagementService);
		const request = {
			auth: { type: 'user', id: actorId, role: UserRole.ADMIN },
		} as unknown as AuthenticatedRequest;

		const response = await controller.revokeAll(request);

		expect(revokeAll).toHaveBeenCalledWith(actorId);
		expect(response.data).toEqual({ revoked: true });
	});
});
