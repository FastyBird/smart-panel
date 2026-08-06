import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { McpClientEntity } from '../entities/mcp-client.entity';

import { McpClientCredentialModel } from './mcp-client.model';

@ApiSchema({ name: 'McpModuleResClient' })
export class McpClientResponseModel extends BaseSuccessResponseModel<McpClientEntity> {
	@ApiProperty({ type: () => McpClientEntity })
	@Expose()
	declare data: McpClientEntity;
}

@ApiSchema({ name: 'McpModuleResClients' })
export class McpClientsResponseModel extends BaseSuccessResponseModel<McpClientEntity[]> {
	@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(McpClientEntity) } })
	@Expose()
	declare data: McpClientEntity[];
}

@ApiSchema({ name: 'McpModuleResClientCredential' })
export class McpClientCredentialResponseModel extends BaseSuccessResponseModel<McpClientCredentialModel> {
	@ApiProperty({ type: () => McpClientCredentialModel })
	@Expose()
	declare data: McpClientCredentialModel;
}
