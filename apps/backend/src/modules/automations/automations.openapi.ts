/**
 * OpenAPI extra models for Automations module
 */
import { AutomationGraphDto, AutomationGraphEdgeDto, AutomationGraphNodeDto } from './dto/automation-graph.dto';
import { ReqTriggerAutomationDto, TriggerAutomationDto } from './dto/trigger-automation.dto';
import { UpdateAutomationsConfigDto } from './dto/update-config.dto';
import { ReqValidateAutomationGraphDto, ValidateAutomationGraphDto } from './dto/validate-graph.dto';
import { AutomationRunEntity } from './entities/automation-runs.entity';
import { AutomationEntity } from './entities/automations.entity';
import {
	AutomationGraphEdgeModel,
	AutomationGraphModel,
	AutomationGraphNodeModel,
	AutomationGraphNodePositionModel,
} from './models/automation-graph.model';
import {
	AutomationRunStepModel,
	AutomationRunStepResultModel,
	AutomationRunTraceModel,
	AutomationRunTriggerModel,
} from './models/automation-run-trace.model';
import { AutomationRunSummaryModel } from './models/automation-runs.model';
import {
	AutomationProblemModel,
	AutomationRuntimeModel,
	AutomationSkippedTriggerModel,
	AutomationTriggerCountersModel,
} from './models/automation-runtime.model';
import { AutomationTriggerResultModel } from './models/automation-trigger-result.model';
import {
	AutomationGraphValidationResponseModel,
	AutomationNodeTypesResponseModel,
	AutomationResponseModel,
	AutomationRunResponseModel,
	AutomationRunsResponseModel,
	AutomationRuntimeResponseModel,
	AutomationTriggerResultResponseModel,
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
	TriggerAutomationDto,
	ReqTriggerAutomationDto,
	// Response models
	AutomationResponseModel,
	AutomationsResponseModel,
	AutomationGraphValidationResponseModel,
	AutomationNodeTypesResponseModel,
	AutomationTriggerResultResponseModel,
	AutomationRuntimeResponseModel,
	AutomationRunsResponseModel,
	AutomationRunResponseModel,
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
	AutomationTriggerResultModel,
	AutomationRuntimeModel,
	AutomationTriggerCountersModel,
	AutomationSkippedTriggerModel,
	AutomationProblemModel,
	AutomationRunSummaryModel,
	AutomationRunTraceModel,
	AutomationRunTriggerModel,
	AutomationRunStepModel,
	AutomationRunStepResultModel,
	// Entities
	AutomationEntity,
	AutomationRunEntity,
];
