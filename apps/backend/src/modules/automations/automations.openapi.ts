/**
 * OpenAPI extra models for Automations module
 */
import { AutomationGraphDto, AutomationGraphEdgeDto, AutomationGraphNodeDto } from './dto/automation-graph.dto';
import { UpdateAutomationsConfigDto } from './dto/update-config.dto';
import { ReqValidateAutomationGraphDto, ValidateAutomationGraphDto } from './dto/validate-graph.dto';
import { AutomationEntity } from './entities/automations.entity';
import {
	AutomationGraphEdgeModel,
	AutomationGraphModel,
	AutomationGraphNodeModel,
	AutomationGraphNodePositionModel,
} from './models/automation-graph.model';
import {
	AutomationGraphValidationResponseModel,
	AutomationNodeTypesResponseModel,
	AutomationResponseModel,
	AutomationsResponseModel,
} from './models/automations-response.model';
import { AutomationSummaryModel } from './models/automations.model';
import { AutomationsConfigModel } from './models/config.model';
import { AutomationGraphIssueModel, AutomationGraphValidationModel } from './models/graph-validation.model';
import { AutomationNodeTypeModel, AutomationNodeTypePortsModel } from './models/node-types.model';

export const AUTOMATIONS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	AutomationsConfigModel,
	UpdateAutomationsConfigDto,
	// DTOs referenced only through array items
	AutomationGraphDto,
	AutomationGraphNodeDto,
	AutomationGraphEdgeDto,
	ValidateAutomationGraphDto,
	ReqValidateAutomationGraphDto,
	// Response models
	AutomationResponseModel,
	AutomationsResponseModel,
	AutomationGraphValidationResponseModel,
	AutomationNodeTypesResponseModel,
	// Data models
	AutomationSummaryModel,
	AutomationGraphModel,
	AutomationGraphNodeModel,
	AutomationGraphNodePositionModel,
	AutomationGraphEdgeModel,
	AutomationGraphIssueModel,
	AutomationGraphValidationModel,
	AutomationNodeTypeModel,
	AutomationNodeTypePortsModel,
	// Entities
	AutomationEntity,
];
