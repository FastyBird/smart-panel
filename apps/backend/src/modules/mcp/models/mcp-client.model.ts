import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { McpClientEntity } from '../entities/mcp-client.entity';

@ApiSchema({ name: 'McpModuleDataClientCredential' })
export class McpClientCredentialModel {
	@ApiProperty({ description: 'Created or rotated client', type: () => McpClientEntity })
	@Expose()
	client: McpClientEntity;

	@ApiProperty({
		description: 'One-time credential value. It cannot be retrieved after this response.',
		type: 'string',
	})
	@Expose()
	token: string;
}
