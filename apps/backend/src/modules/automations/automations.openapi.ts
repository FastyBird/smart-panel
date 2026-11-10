/**
 * OpenAPI extra models for Automations module
 */
import { AutomationGraphDto, AutomationGraphEdgeDto, AutomationGraphNodeDto } from './dto/automation-graph.dto';
import { UpdateAutomationsConfigDto } from './dto/update-config.dto';
import { AutomationEntity } from './entities/automations.entity';
import {
	AutomationGraphEdgeModel,
	AutomationGraphModel,
	AutomationGraphNodeModel,
	AutomationGraphNodePositionModel,
} from './models/automation-graph.model';
import { AutomationResponseModel, AutomationsResponseModel } from './models/automations-response.model';
import { AutomationSummaryModel } from './models/automations.model';
import { AutomationsConfigModel } from './models/config.model';

export const AUTOMATIONS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	AutomationsConfigModel,
	UpdateAutomationsConfigDto,
	// DTOs referenced only through array items
	AutomationGraphDto,
	AutomationGraphNodeDto,
	AutomationGraphEdgeDto,
	// Response models
	AutomationResponseModel,
	AutomationsResponseModel,
	// Data models
	AutomationSummaryModel,
	AutomationGraphModel,
	AutomationGraphNodeModel,
	AutomationGraphNodePositionModel,
	AutomationGraphEdgeModel,
	// Entities
	AutomationEntity,
];
