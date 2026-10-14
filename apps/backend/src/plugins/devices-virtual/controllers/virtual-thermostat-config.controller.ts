import {
	Body,
	Controller,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Req,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ApiForbiddenResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import {
	ConfigureVirtualThermostatDto,
	RequestVirtualThermostatReleaseDto,
	RestoreVirtualThermostatActuatorDto,
} from '../dto/thermostat-config.dto';
import {
	VirtualThermostatConfigurationModel,
	VirtualThermostatConfigurationResponseModel,
	VirtualThermostatRecoveriesResponseModel,
	VirtualThermostatRecoveryModel,
	VirtualThermostatRuntimeModel,
	VirtualThermostatRuntimeResponseModel,
} from '../models/thermostat-response.model';
import { VirtualThermostatConfigService } from '../services/virtual-thermostat-config.service';
import { VirtualThermostatRuntimeService } from '../services/virtual-thermostat-runtime.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers')
export class VirtualThermostatConfigController {
	constructor(
		private readonly configs: VirtualThermostatConfigService,
		private readonly runtime: VirtualThermostatRuntimeService,
	) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read thermostat runtime',
		description:
			'Read requested comfort intent, qualified measurements, physical branch activity and independent inhibit reasons.',
		operationId: 'get-devices-virtual-plugin-thermostat-runtime',
	})
	@ApiSuccessResponse(VirtualThermostatRuntimeResponseModel, 'Thermostat runtime')
	@Get('thermostats/:id/runtime')
	async getRuntime(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualThermostatRuntimeResponseModel> {
		const runtime = await this.runtime.inspect(id);
		if (!runtime) throw new NotFoundException('Thermostat configuration does not exist.');
		const response = new VirtualThermostatRuntimeResponseModel();
		response.data = Object.assign(new VirtualThermostatRuntimeModel(), runtime);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read thermostat configuration',
		description: 'Read role-aware sources, persistent reservations, registered settings and activation blockers.',
		operationId: 'get-devices-virtual-plugin-thermostat-configuration',
	})
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Thermostat configuration')
	@Get('thermostats/:id')
	async get(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.get(id));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Configure thermostat',
		description:
			'Atomically validate configuration, register local settings and reserve canonical physical actuator leaves. Authoring remains draft until installed hardware qualification and durable runtime reconciliation.',
		operationId: 'configure-devices-virtual-plugin-thermostat',
	})
	@ApiUnprocessableEntityResponse('Policy, reservation, source or revision conflict')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Durable thermostat configuration')
	@Put('thermostats/:id')
	async configure(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualThermostatDto,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.configure(id, dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview thermostat configuration',
		description:
			'Run the same configuration and ownership checks without reserving hardware or changing local permissions.',
		operationId: 'preview-devices-virtual-plugin-thermostat',
	})
	@ApiUnprocessableEntityResponse('Policy, reservation, source or revision conflict')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Proposed thermostat configuration')
	@Post('thermostats/:id/preview')
	async preview(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureVirtualThermostatDto,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.preview(id, dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Request thermostat actuator release',
		description:
			'Persist user OFF and prioritized release demand while retaining every reservation. Dispatch acceptance, timeout and unrelated OFF readback do not free hardware.',
		operationId: 'release-devices-virtual-plugin-thermostat',
	})
	@ApiUnprocessableEntityResponse('Configuration revision conflict')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Pending release and retained reservations')
	@Post('thermostats/:id/release')
	async release(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: RequestVirtualThermostatReleaseDto,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		return this.response(() => this.configs.requestRelease(id, dto.expectedRevision));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Restore a missing thermostat actuator endpoint',
		description:
			'Owner or administrator re-adopts only the same canonical physical switch. Forces requested OFF, revokes prior hardware qualification and retains the reservation; operator acknowledgement is not release proof.',
		operationId: 'restore-devices-virtual-plugin-thermostat-actuator',
	})
	@ApiForbiddenResponse('Owner or administrator user session required')
	@ApiUnprocessableEntityResponse('Claim revision, canonical identity or endpoint conflict')
	@ApiSuccessResponse(VirtualThermostatConfigurationResponseModel, 'Restored reservation awaiting new qualification')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post('thermostats/:id/claims/:claimId/restore')
	async restoreActuator(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
		@Body() dto: RestoreVirtualThermostatActuatorDto,
		@Req() req: AuthenticatedRequest,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		if (req.auth?.type !== 'user') throw new ForbiddenException('An identified operator user session is required.');
		const actorId = req.auth.id;
		return this.response(() => this.configs.restoreActuator(id, claimId, dto, actorId));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read thermostat actuator recovery audit',
		description:
			'Read retained operator recovery declarations, distinct from machine-verified OFF and drainage evidence.',
		operationId: 'get-devices-virtual-plugin-thermostat-recoveries',
	})
	@ApiForbiddenResponse('Owner or administrator access required')
	@ApiSuccessResponse(VirtualThermostatRecoveriesResponseModel, 'Recovery audit entries')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get('thermostats/:id/recoveries')
	async recoveries(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualThermostatRecoveriesResponseModel> {
		const response = new VirtualThermostatRecoveriesResponseModel();
		response.data = (await this.configs.recoveryEvents(id)).map((row) =>
			Object.assign(new VirtualThermostatRecoveryModel(), row),
		);
		return response;
	}

	private async response(
		operation: () => Promise<Awaited<ReturnType<VirtualThermostatConfigService['get']>>>,
	): Promise<VirtualThermostatConfigurationResponseModel> {
		try {
			const response = new VirtualThermostatConfigurationResponseModel();
			response.data = Object.assign(new VirtualThermostatConfigurationModel(), await operation());
			return response;
		} catch (error) {
			if (error instanceof DevicesValidationException) throw new UnprocessableEntityException(error.message);
			throw error;
		}
	}
}
