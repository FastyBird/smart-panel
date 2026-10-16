import { EntityNotFoundError } from 'typeorm';

import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import { ThermostatAuthoringContextResponseModel } from '../models/thermostat-authoring-context.model';
import { ThermostatAuthoringContextService } from '../services/thermostat-authoring-context.service';

@ApiExtraModels(ThermostatAuthoringContextResponseModel)
@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers/thermostat-member-authoring')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class ThermostatAuthoringContextController {
	constructor(private readonly context: ThermostatAuthoringContextService) {}
	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read local protective source choices',
		description:
			'Return server-qualified Celsius sources on the selected physical relay and read-only public setup metadata. Does not query or operate equipment or confer qualification.',
		operationId: 'get-devices-virtual-plugin-thermostat-member-candidates',
	})
	@ApiSuccessResponse(ThermostatAuthoringContextResponseModel, 'Local protective source choices')
	@Get('actuators/:property')
	async candidates(
		@Param('property', new ParseUUIDPipe({ version: '4' })) property: string,
		@Req() req: AuthenticatedRequest,
	): Promise<ThermostatAuthoringContextResponseModel> {
		this.authorize(req);
		return this.response(() => this.context.read(property));
	}
	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read member installation authoring context',
		description:
			'Review current claim/configuration revisions, eligible local sources and cached public component metadata before staging. Missing metadata blocks staging; no deployment or activation occurs.',
		operationId: 'get-devices-virtual-plugin-thermostat-member-authoring-context',
	})
	@ApiSuccessResponse(ThermostatAuthoringContextResponseModel, 'Member setup context')
	@Get('claims/:claim')
	async claim(
		@Param('claim', new ParseUUIDPipe({ version: '4' })) claim: string,
		@Req() req: AuthenticatedRequest,
	): Promise<ThermostatAuthoringContextResponseModel> {
		this.authorize(req);
		return this.response(() => this.context.forClaim(claim));
	}
	private authorize(req: AuthenticatedRequest) {
		if (req.auth?.type !== 'user' || !req.auth.id || ![UserRole.OWNER, UserRole.ADMIN].includes(req.auth.role))
			throw new ForbiddenException('Owner or administrator user session required for installation authoring.');
	}
	private async response(
		read: () => ReturnType<ThermostatAuthoringContextService['read']>,
	): Promise<ThermostatAuthoringContextResponseModel> {
		try {
			const response = new ThermostatAuthoringContextResponseModel();
			response.data = await read();
			return response;
		} catch (error) {
			if (error instanceof EntityNotFoundError) throw new NotFoundException('Actuator or claim is missing.');
			throw error;
		}
	}
}
