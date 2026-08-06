import { UpdateMcpConfigDto } from './dto/update-config.dto';
import { McpConfigModel } from './models/config.model';

export const MCP_SWAGGER_EXTRA_MODELS = [McpConfigModel, UpdateMcpConfigDto];
