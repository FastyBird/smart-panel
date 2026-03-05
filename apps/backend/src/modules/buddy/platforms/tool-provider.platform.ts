/**
 * Re-export tool provider interfaces from the shared tools module.
 * This preserves backward compatibility for any code importing from buddy.
 */
export type { IToolProvider, LlmToolCall, ToolDefinition, ToolExecutionResult } from '../../tools/platforms/tool-provider.platform';
