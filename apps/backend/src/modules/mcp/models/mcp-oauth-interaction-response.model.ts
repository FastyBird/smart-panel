import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { McpOAuthInteractionCompletionModel, McpOAuthInteractionModel } from './mcp-oauth-interaction.model';

@ApiSchema({ name: 'McpModuleResOAuthInteraction' })
export class McpOAuthInteractionResponseModel extends BaseSuccessResponseModel<McpOAuthInteractionModel> {
	@ApiProperty({ type: () => McpOAuthInteractionModel })
	@Expose()
	declare data: McpOAuthInteractionModel;
}

@ApiSchema({ name: 'McpModuleResOAuthInteractionCompletion' })
export class McpOAuthInteractionCompletionResponseModel extends BaseSuccessResponseModel<McpOAuthInteractionCompletionModel> {
	@ApiProperty({ type: () => McpOAuthInteractionCompletionModel })
	@Expose()
	declare data: McpOAuthInteractionCompletionModel;
}
