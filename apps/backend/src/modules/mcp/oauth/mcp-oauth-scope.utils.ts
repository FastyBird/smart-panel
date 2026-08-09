import { McpCapability, McpOAuthScope } from '../mcp.constants';

export const toMcpCapability = (scope: McpOAuthScope): McpCapability | undefined => {
	switch (scope) {
		case McpOAuthScope.READ:
			return McpCapability.READ;
		case McpOAuthScope.WRITE:
			return McpCapability.WRITE;
		case McpOAuthScope.TRIGGER:
			return McpCapability.TRIGGER;
		case McpOAuthScope.OFFLINE_ACCESS:
			return undefined;
	}
};

export const toMcpOAuthScope = (capability: McpCapability): McpOAuthScope => {
	switch (capability) {
		case McpCapability.READ:
			return McpOAuthScope.READ;
		case McpCapability.WRITE:
			return McpOAuthScope.WRITE;
		case McpCapability.TRIGGER:
			return McpOAuthScope.TRIGGER;
	}
};
