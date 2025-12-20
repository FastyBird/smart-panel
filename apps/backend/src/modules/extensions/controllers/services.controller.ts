import { Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { EXTENSIONS_MODULE_API_TAG_NAME, EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import {
	ServiceStatusModel,
	ServiceStatusResponseModel,
	ServicesStatusResponseModel,
} from '../models/service-status.model';
import { PluginServiceManagerService } from '../services/plugin-service-manager.service';

@ApiTags(EXTENSIONS_MODULE_API_TAG_NAME)
@Controller('services')
export class ServicesController {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ServicesController');

	constructor(private readonly pluginServiceManager: PluginServiceManagerService) {}

	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'get-extensions-module-services',
		summary: 'List all managed services',
		description: 'Retrieves a list of all managed plugin services with their current status and runtime information.',
	})
	@ApiSuccessResponse(ServicesStatusResponseModel, 'Returns a list of service statuses')
	async findAll(): Promise<ServicesStatusResponseModel> {
		this.logger.debug('Fetching all service statuses');

		const statuses = await this.pluginServiceManager.getStatus();

		const response = new ServicesStatusResponseModel();
		response.data = statuses.map((status) => this.toModel(status));

		return response;
	}

	@Get(':pluginName/:serviceId')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	@ApiOperation({
		operationId: 'get-extensions-module-service',
		summary: 'Get service status',
		description: 'Retrieves the status of a specific managed plugin service.',
	})
	@ApiParam({ name: 'pluginName', type: 'string', description: 'Plugin name identifier' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the plugin' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the service status')
	@ApiNotFoundResponse('Service not found')
	async findOne(
		@Param('pluginName') pluginName: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		this.logger.debug(`Fetching service status pluginName=${pluginName} serviceId=${serviceId}`);

		const status = await this.pluginServiceManager.getServiceStatus(pluginName, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${pluginName}:${serviceId} not found`);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	@Post(':pluginName/:serviceId/start')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'start-extensions-module-service',
		summary: 'Start a service',
		description: 'Manually starts a specific plugin service.',
	})
	@ApiParam({ name: 'pluginName', type: 'string', description: 'Plugin name identifier' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the plugin' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the updated service status')
	@ApiNotFoundResponse('Service not found')
	@ApiBadRequestResponse('Service is already started or starting')
	async start(
		@Param('pluginName') pluginName: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		this.logger.debug(`Starting service pluginName=${pluginName} serviceId=${serviceId}`);

		const success = await this.pluginServiceManager.startServiceManually(pluginName, serviceId);

		const status = await this.pluginServiceManager.getServiceStatus(pluginName, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${pluginName}:${serviceId} not found`);
		}

		if (!success) {
			this.logger.debug(`Service ${pluginName}:${serviceId} start returned false, current state: ${status.state}`);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	@Post(':pluginName/:serviceId/stop')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'stop-extensions-module-service',
		summary: 'Stop a service',
		description: 'Manually stops a specific plugin service.',
	})
	@ApiParam({ name: 'pluginName', type: 'string', description: 'Plugin name identifier' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the plugin' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the updated service status')
	@ApiNotFoundResponse('Service not found')
	@ApiBadRequestResponse('Service is already stopped or stopping')
	async stop(
		@Param('pluginName') pluginName: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		this.logger.debug(`Stopping service pluginName=${pluginName} serviceId=${serviceId}`);

		const success = await this.pluginServiceManager.stopServiceManually(pluginName, serviceId);

		const status = await this.pluginServiceManager.getServiceStatus(pluginName, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${pluginName}:${serviceId} not found`);
		}

		if (!success) {
			this.logger.debug(`Service ${pluginName}:${serviceId} stop returned false, current state: ${status.state}`);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	@Post(':pluginName/:serviceId/restart')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		operationId: 'restart-extensions-module-service',
		summary: 'Restart a service',
		description: 'Restarts a specific plugin service. The plugin must be enabled for restart to work.',
	})
	@ApiParam({ name: 'pluginName', type: 'string', description: 'Plugin name identifier' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the plugin' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the updated service status')
	@ApiNotFoundResponse('Service not found')
	@ApiBadRequestResponse('Plugin is disabled or service cannot be restarted')
	async restart(
		@Param('pluginName') pluginName: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		this.logger.debug(`Restarting service pluginName=${pluginName} serviceId=${serviceId}`);

		const success = await this.pluginServiceManager.restartService(pluginName, serviceId);

		const status = await this.pluginServiceManager.getServiceStatus(pluginName, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${pluginName}:${serviceId} not found`);
		}

		if (!success) {
			this.logger.debug(`Service ${pluginName}:${serviceId} restart returned false, current state: ${status.state}`);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	private toModel(status: {
		pluginName: string;
		serviceId: string;
		state: string;
		enabled: boolean;
		healthy?: boolean;
		lastStartedAt?: string;
		lastStoppedAt?: string;
		lastError?: string;
		startCount: number;
		uptimeMs?: number;
	}): ServiceStatusModel {
		const model = new ServiceStatusModel();
		model.pluginName = status.pluginName;
		model.serviceId = status.serviceId;
		model.state = status.state as ServiceStatusModel['state'];
		model.enabled = status.enabled;
		model.healthy = status.healthy;
		model.lastStartedAt = status.lastStartedAt;
		model.lastStoppedAt = status.lastStoppedAt;
		model.lastError = status.lastError;
		model.startCount = status.startCount;
		model.uptimeMs = status.uptimeMs;

		return model;
	}
}
