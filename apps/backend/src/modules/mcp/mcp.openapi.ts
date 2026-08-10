import {
	CreateMcpClientDto,
	ReqCreateMcpClientDto,
	ReqRotateMcpClientTokenDto,
	ReqUpdateMcpClientDto,
	RotateMcpClientTokenDto,
	UpdateMcpClientDto,
} from './dto/mcp-client.dto';
import {
	CreateMcpOAuthClientDto,
	ReqCreateMcpOAuthClientDto,
	ReqUpdateMcpOAuthClientDto,
	UpdateMcpOAuthClientDto,
} from './dto/mcp-oauth-client.dto';
import { ReqUpdateMcpOAuthGrantDto, UpdateMcpOAuthGrantDto } from './dto/mcp-oauth-grant.dto';
import { ApproveMcpOAuthInteractionDto, ReqApproveMcpOAuthInteractionDto } from './dto/mcp-oauth-interaction.dto';
import { UpdateMcpConfigDto } from './dto/update-config.dto';
import { McpClientEntity } from './entities/mcp-client.entity';
import { McpConfigModel } from './models/config.model';
import {
	McpClientCredentialResponseModel,
	McpClientResponseModel,
	McpClientsResponseModel,
} from './models/mcp-client-response.model';
import { McpClientCredentialModel } from './models/mcp-client.model';
import { McpOAuthClientResponseModel, McpOAuthClientsResponseModel } from './models/mcp-oauth-client-response.model';
import { McpOAuthClientModel } from './models/mcp-oauth-client.model';
import {
	McpOAuthInteractionCompletionResponseModel,
	McpOAuthInteractionResponseModel,
} from './models/mcp-oauth-interaction-response.model';
import { McpOAuthInteractionCompletionModel, McpOAuthInteractionModel } from './models/mcp-oauth-interaction.model';
import {
	McpOAuthAccessTokenResponseModel,
	McpOAuthAccessTokensResponseModel,
	McpOAuthGlobalRevocationResponseModel,
	McpOAuthGrantResponseModel,
	McpOAuthGrantsResponseModel,
	McpOAuthRefreshFamiliesResponseModel,
	McpOAuthRefreshFamilyResponseModel,
} from './models/mcp-oauth-management-response.model';
import {
	McpOAuthAccessTokenModel,
	McpOAuthGlobalRevocationModel,
	McpOAuthGrantModel,
	McpOAuthRefreshFamilyModel,
} from './models/mcp-oauth-management.model';

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
	CreateMcpOAuthClientDto,
	UpdateMcpOAuthClientDto,
	ReqCreateMcpOAuthClientDto,
	ReqUpdateMcpOAuthClientDto,
	McpOAuthClientModel,
	McpOAuthClientResponseModel,
	McpOAuthClientsResponseModel,
	ApproveMcpOAuthInteractionDto,
	ReqApproveMcpOAuthInteractionDto,
	UpdateMcpOAuthGrantDto,
	ReqUpdateMcpOAuthGrantDto,
	McpOAuthInteractionModel,
	McpOAuthInteractionCompletionModel,
	McpOAuthInteractionResponseModel,
	McpOAuthInteractionCompletionResponseModel,
	McpOAuthGrantModel,
	McpOAuthAccessTokenModel,
	McpOAuthGlobalRevocationModel,
	McpOAuthRefreshFamilyModel,
	McpOAuthGrantResponseModel,
	McpOAuthGrantsResponseModel,
	McpOAuthAccessTokenResponseModel,
	McpOAuthAccessTokensResponseModel,
	McpOAuthGlobalRevocationResponseModel,
	McpOAuthRefreshFamilyResponseModel,
	McpOAuthRefreshFamiliesResponseModel,
];
