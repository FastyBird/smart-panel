import {
	Body,
	Controller,
	ForbiddenException,
	Get,
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
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import {
	CancelThermostatOverrideDto,
	ConfigureThermostatComfortDto,
	CreateThermostatOverrideDto,
	SelectThermostatPresetDto,
} from '../dto/thermostat-comfort.dto';
import { ThermostatComfortModel, ThermostatComfortResponseModel } from '../models/thermostat-comfort-response.model';
import { VirtualThermostatComfortService } from '../services/virtual-thermostat-comfort.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers/thermostats/:id/comfort')
export class VirtualThermostatComfortController {
	constructor(private readonly comfort: VirtualThermostatComfortService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read thermostat comfort arbitration',
		description:
			'Read manual/preset/override intent, durable expiry state and explicit restart clock policy. Physical activity and guards remain in the runtime endpoint.',
		operationId: 'get-devices-virtual-plugin-thermostat-comfort',
	})
	@ApiSuccessResponse(ThermostatComfortResponseModel, 'Current comfort arbitration')
	@Get()
	get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ThermostatComfortResponseModel> {
		return this.response(() => this.comfort.get(id));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Configure explicit thermostat presets',
		description:
			'Configure Celsius ranges and comfort/eco/away setpoints without seeding temperatures . Automation requires explicit opt-in; no engines run here. A live override retains its resolved setpoints.',
		operationId: 'configure-devices-virtual-plugin-thermostat-comfort',
	})
	@ApiUnprocessableEntityResponse('Invalid branch, range, deadband or revision')
	@ApiSuccessResponse(ThermostatComfortResponseModel, 'Configured comfort arbitration')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Put()
	configure(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ConfigureThermostatComfortDto,
	): Promise<ThermostatComfortResponseModel> {
		return this.response(() =>
			this.comfort.configure(id, dto, {
				heating_range: dto.heating_range,
				cooling_range: dto.cooling_range,
				presets: dto.presets,
				automation_enabled: dto.automation_enabled,
			}),
		);
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Select thermostat baseline preset',
		description:
			'Select the current preset/manual baseline without overwriting an override. Clearing user OFF requires an explicit action; HVAC mode is separate.',
		operationId: 'select-devices-virtual-plugin-thermostat-preset',
	})
	@ApiUnprocessableEntityResponse('Missing preset, locked controller or revision conflict')
	@ApiSuccessResponse(ThermostatComfortResponseModel, 'Selected baseline')
	@Post('selection')
	select(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: SelectThermostatPresetDto,
	): Promise<ThermostatComfortResponseModel> {
		return this.response(() => this.comfort.select(id, dto, dto.preset, dto.clear_user_off));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Create temporary thermostat override',
		description:
			'An authenticated user selects a preset or explicit setpoints until an absolute expiry. Source and actor are assigned by the server. Does not clear user OFF or bypass guards.',
		operationId: 'create-devices-virtual-plugin-thermostat-override',
	})
	@ApiUnprocessableEntityResponse('Invalid override, locked controller or revision conflict')
	@ApiSuccessResponse(ThermostatComfortResponseModel, 'Durable temporary override')
	@Post('override')
	override(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: CreateThermostatOverrideDto,
		@Req() request: AuthenticatedRequest,
	): Promise<ThermostatComfortResponseModel> {
		if (request.auth?.type !== 'user') throw new ForbiddenException('An identified user session is required.');
		const actorId = request.auth.id;
		return this.response(() =>
			this.comfort.override(
				id,
				dto,
				{
					preset: dto.preset,
					setpoints: dto.setpoints,
					expires_at: dto.expires_at,
				},
				actorId,
			),
		);
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Cancel temporary thermostat override',
		description:
			'Terminate only the identified active override and recompute the current baseline. Does not replay a historical command or clear user OFF.',
		operationId: 'cancel-devices-virtual-plugin-thermostat-override',
	})
	@ApiUnprocessableEntityResponse('Override identity or revision conflict')
	@ApiSuccessResponse(ThermostatComfortResponseModel, 'Recomputed current baseline')
	@Post('override/cancel')
	cancel(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: CancelThermostatOverrideDto,
	): Promise<ThermostatComfortResponseModel> {
		return this.response(() => this.comfort.cancel(id, dto, dto.override_id));
	}

	private async response(
		operation: () => ReturnType<VirtualThermostatComfortService['get']>,
	): Promise<ThermostatComfortResponseModel> {
		try {
			const response = new ThermostatComfortResponseModel();
			response.data = Object.assign(new ThermostatComfortModel(), await operation());
			return response;
		} catch (error) {
			if (error instanceof DevicesValidationException) throw new UnprocessableEntityException(error.message);
			throw error;
		}
	}
}
