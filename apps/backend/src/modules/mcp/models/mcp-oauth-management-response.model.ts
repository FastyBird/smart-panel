import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { McpOAuthAccessTokenModel, McpOAuthGrantModel, McpOAuthRefreshFamilyModel } from './mcp-oauth-management.model';

@ApiSchema({ name: 'McpModuleResOAuthGrant' })
export class McpOAuthGrantResponseModel extends BaseSuccessResponseModel<McpOAuthGrantModel> {
	@ApiProperty({ type: () => McpOAuthGrantModel })
	@Expose()
	declare data: McpOAuthGrantModel;
}

@ApiSchema({ name: 'McpModuleResOAuthGrants' })
export class McpOAuthGrantsResponseModel extends BaseSuccessResponseModel<McpOAuthGrantModel[]> {
	@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(McpOAuthGrantModel) } })
	@Expose()
	declare data: McpOAuthGrantModel[];
}

@ApiSchema({ name: 'McpModuleResOAuthAccessToken' })
export class McpOAuthAccessTokenResponseModel extends BaseSuccessResponseModel<McpOAuthAccessTokenModel> {
	@ApiProperty({ type: () => McpOAuthAccessTokenModel })
	@Expose()
	declare data: McpOAuthAccessTokenModel;
}

@ApiSchema({ name: 'McpModuleResOAuthAccessTokens' })
export class McpOAuthAccessTokensResponseModel extends BaseSuccessResponseModel<McpOAuthAccessTokenModel[]> {
	@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(McpOAuthAccessTokenModel) } })
	@Expose()
	declare data: McpOAuthAccessTokenModel[];
}

@ApiSchema({ name: 'McpModuleResOAuthRefreshFamily' })
export class McpOAuthRefreshFamilyResponseModel extends BaseSuccessResponseModel<McpOAuthRefreshFamilyModel> {
	@ApiProperty({ type: () => McpOAuthRefreshFamilyModel })
	@Expose()
	declare data: McpOAuthRefreshFamilyModel;
}

@ApiSchema({ name: 'McpModuleResOAuthRefreshFamilies' })
export class McpOAuthRefreshFamiliesResponseModel extends BaseSuccessResponseModel<McpOAuthRefreshFamilyModel[]> {
	@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(McpOAuthRefreshFamilyModel) } })
	@Expose()
	declare data: McpOAuthRefreshFamilyModel[];
}
