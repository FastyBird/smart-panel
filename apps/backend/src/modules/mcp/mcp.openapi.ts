import {
	CreateMcpClientDto,
	ReqCreateMcpClientDto,
	ReqRotateMcpClientTokenDto,
	ReqUpdateMcpClientDto,
	RotateMcpClientTokenDto,
	UpdateMcpClientDto,
} from './dto/mcp-client.dto';
import { UpdateMcpConfigDto } from './dto/update-config.dto';
import { McpClientEntity } from './entities/mcp-client.entity';
import { McpConfigModel } from './models/config.model';
import {
	McpClientCredentialResponseModel,
	McpClientResponseModel,
	McpClientsResponseModel,
} from './models/mcp-client-response.model';
import { McpClientCredentialModel } from './models/mcp-client.model';

export const MCP_SWAGGER_EXTRA_MODELS = [
	McpConfigModel,
	UpdateMcpConfigDto,
	McpClientEntity,
	CreateMcpClientDto,
	UpdateMcpClientDto,
	RotateMcpClientTokenDto,
	ReqCreateMcpClientDto,
	ReqUpdateMcpClientDto,
	ReqRotateMcpClientTokenDto,
	McpClientCredentialModel,
	McpClientResponseModel,
	McpClientsResponseModel,
	McpClientCredentialResponseModel,
];
