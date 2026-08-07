import { SetMetadata } from '@nestjs/common';

import { IS_MCP_ENDPOINT_KEY } from '../mcp.constants';

/** Marks the protocol endpoint as accepting only installation-local MCP credentials. */
export const McpEndpoint = () => SetMetadata(IS_MCP_ENDPOINT_KEY, true);
