import { BadRequestException, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
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
import { ManagedServiceOwnerKind, ServiceStatusExtended } from '../services/managed-extension-service.interface';
import { ManagedServiceManagerService } from '../services/managed-service-manager.service';

@ApiTags(EXTENSIONS_MODULE_API_TAG_NAME)
@Controller('services')
export class ServicesController {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ServicesController');

	constructor(private readonly managedServiceManager: ManagedServiceManagerService) {}

	@ApiOperation({
		operationId: 'get-extensions-module-services',
		summary: 'List all managed services',
		description: 'Retrieves all managed module and plugin services with their status and runtime information.',
	})
	@ApiSuccessResponse(ServicesStatusResponseModel, 'Returns a list of service statuses')
	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	async findAll(): Promise<ServicesStatusResponseModel> {
		const statuses = await this.managedServiceManager.getStatus();

		const response = new ServicesStatusResponseModel();
		response.data = statuses.map((status) => this.toModel(status));

		return response;
	}

	@ApiOperation({
		operationId: 'get-extensions-module-service',
		summary: 'Get service status',
		description: 'Retrieves the status of a specific managed extension service.',
	})
	@ApiParam({ name: 'extensionKind', enum: ['module', 'plugin'], description: 'Extension owner kind' })
	@ApiParam({ name: 'extensionType', type: 'string', description: 'Extension owner type' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the extension' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the service status')
	@ApiNotFoundResponse('Service not found')
	@Get(':extensionKind/:extensionType/:serviceId')
	@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER)
	async findOne(
		@Param('extensionKind') extensionKind: ManagedServiceOwnerKind,
		@Param('extensionType') extensionType: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		const status = await this.managedServiceManager.getServiceStatus(extensionKind, extensionType, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${extensionKind}:${extensionType}:${serviceId} not found`);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	@ApiOperation({
		operationId: 'start-extensions-module-service',
		summary: 'Start a service',
		description: 'Manually starts a specific extension service when its desired state permits it.',
	})
	@ApiParam({ name: 'extensionKind', enum: ['module', 'plugin'], description: 'Extension owner kind' })
	@ApiParam({ name: 'extensionType', type: 'string', description: 'Extension owner type' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the extension' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the updated service status')
	@ApiNotFoundResponse('Service not found')
	@ApiBadRequestResponse('Service cannot be started or failed to reach a valid launch state')
	@Post(':extensionKind/:extensionType/:serviceId/start')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async start(
		@Param('extensionKind') extensionKind: ManagedServiceOwnerKind,
		@Param('extensionType') extensionType: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		const success = await this.managedServiceManager.startServiceManually(extensionKind, extensionType, serviceId);

		const status = await this.managedServiceManager.getServiceStatus(extensionKind, extensionType, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${extensionKind}:${extensionType}:${serviceId} not found`);
		}

		if (!success) {
			throw new BadRequestException(
				`Service ${extensionKind}:${extensionType}:${serviceId} could not be started from state ${status.state}`,
			);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	@ApiOperation({
		operationId: 'stop-extensions-module-service',
		summary: 'Stop a service',
		description: 'Manually stops a specific extension service.',
	})
	@ApiParam({ name: 'extensionKind', enum: ['module', 'plugin'], description: 'Extension owner kind' })
	@ApiParam({ name: 'extensionType', type: 'string', description: 'Extension owner type' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the extension' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the updated service status')
	@ApiNotFoundResponse('Service not found')
	@ApiBadRequestResponse('Service cannot be stopped or failed to reach the stopped state')
	@Post(':extensionKind/:extensionType/:serviceId/stop')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async stop(
		@Param('extensionKind') extensionKind: ManagedServiceOwnerKind,
		@Param('extensionType') extensionType: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		const success = await this.managedServiceManager.stopServiceManually(extensionKind, extensionType, serviceId);

		const status = await this.managedServiceManager.getServiceStatus(extensionKind, extensionType, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${extensionKind}:${extensionType}:${serviceId} not found`);
		}

		if (!success) {
			throw new BadRequestException(
				`Service ${extensionKind}:${extensionType}:${serviceId} could not be stopped from state ${status.state}`,
			);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	@ApiOperation({
		operationId: 'restart-extensions-module-service',
		summary: 'Restart a service',
		description: 'Restarts a specific extension service when its desired state is started.',
	})
	@ApiParam({ name: 'extensionKind', enum: ['module', 'plugin'], description: 'Extension owner kind' })
	@ApiParam({ name: 'extensionType', type: 'string', description: 'Extension owner type' })
	@ApiParam({ name: 'serviceId', type: 'string', description: 'Service identifier within the extension' })
	@ApiSuccessResponse(ServiceStatusResponseModel, 'Returns the updated service status')
	@ApiNotFoundResponse('Service not found')
	@ApiBadRequestResponse('Service desired state is stopped or service cannot reach a valid launch state')
	@Post(':extensionKind/:extensionType/:serviceId/restart')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async restart(
		@Param('extensionKind') extensionKind: ManagedServiceOwnerKind,
		@Param('extensionType') extensionType: string,
		@Param('serviceId') serviceId: string,
	): Promise<ServiceStatusResponseModel> {
		const success = await this.managedServiceManager.restartService(extensionKind, extensionType, serviceId);

		const status = await this.managedServiceManager.getServiceStatus(extensionKind, extensionType, serviceId);

		if (!status) {
			throw new NotFoundException(`Service ${extensionKind}:${extensionType}:${serviceId} not found`);
		}

		if (!success) {
			throw new BadRequestException(
				`Service ${extensionKind}:${extensionType}:${serviceId} could not be restarted from state ${status.state}`,
			);
		}

		const response = new ServiceStatusResponseModel();
		response.data = this.toModel(status);

		return response;
	}

	private toModel(status: ServiceStatusExtended): ServiceStatusModel {
		const model = new ServiceStatusModel();
		model.extensionKind = status.extensionKind;
		model.extensionType = status.extensionType;
		model.serviceId = status.serviceId;
		model.activationPolicy = status.activationPolicy;
		model.state = status.state;
		model.desiredState = status.desiredState;
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
