import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { McpOAuthClientModel } from './mcp-oauth-client.model';

@ApiSchema({ name: 'McpModuleResOAuthClient' })
export class McpOAuthClientResponseModel extends BaseSuccessResponseModel<McpOAuthClientModel> {
	@ApiProperty({ type: () => McpOAuthClientModel })
	@Expose()
	declare data: McpOAuthClientModel;
}

@ApiSchema({ name: 'McpModuleResOAuthClients' })
export class McpOAuthClientsResponseModel extends BaseSuccessResponseModel<McpOAuthClientModel[]> {
	@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(McpOAuthClientModel) } })
	@Expose()
	declare data: McpOAuthClientModel[];
}
