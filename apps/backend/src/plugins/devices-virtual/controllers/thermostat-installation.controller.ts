import { EntityNotFoundError } from 'typeorm';

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
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import { StageThermostatInstallationDto, ThermostatInstallationRevisionDto } from '../dto/thermostat-installation.dto';
import {
	ThermostatInstallationModel,
	ThermostatInstallationResponseModel,
} from '../models/thermostat-installation-response.model';
import { ThermostatInstallationLoaderService } from '../services/thermostat-installation-loader.service';
import { ThermostatInstallationService } from '../services/thermostat-installation.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers/thermostat-installations')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class ThermostatInstallationController {
	constructor(
		private readonly profiles: ThermostatInstallationService,
		private readonly loader: ThermostatInstallationLoaderService,
	) {}
	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Inspect thermostat installation',
		description:
			'Review expected equipment, operator attestations, machine observations, artifact and readiness blockers.',
		operationId: 'inspect-devices-virtual-plugin-thermostat-installation',
	})
	@ApiSuccessResponse(ThermostatInstallationResponseModel, 'Installation review')
	@ApiNotFoundResponse('No installation profile; stage equipment details first.')
	@Get(':claim')
	async inspect(
		@Param('claim', new ParseUUIDPipe({ version: '4' })) claim: string,
		@Req() req: AuthenticatedRequest,
	): Promise<ThermostatInstallationResponseModel> {
		this.actor(req);
		return this.response(claim);
	}
	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Stage thermostat installation',
		description:
			'CAS persist explicit equipment and human attestations. Revokes queued ON and requests runtime safety release before replacing a profile. Never deploys scripts or changes device configuration.',
		operationId: 'stage-devices-virtual-plugin-thermostat-installation',
	})
	@ApiSuccessResponse(ThermostatInstallationResponseModel, 'Staged installation')
	@ApiNotFoundResponse('Thermostat claim or installation not found.')
	@Put(':claim')
	async stage(
		@Param('claim', new ParseUUIDPipe({ version: '4' })) claim: string,
		@Body() dto: StageThermostatInstallationDto,
		@Req() req: AuthenticatedRequest,
	): Promise<ThermostatInstallationResponseModel> {
		const actor = this.actor(req);
		try {
			await this.profiles.stage(claim, dto.expected_revision, dto.setup, dto.operator_attestations, actor);
		} catch (error) {
			if (error instanceof DevicesValidationException) throw new UnprocessableEntityException(error.message);
			if (error instanceof EntityNotFoundError)
				throw new NotFoundException('Thermostat claim or installation not found.');
			throw error;
		}
		return this.response(claim);
	}
	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Verify and activate thermostat installation',
		description:
			'Read actual device identity, firmware, full script hash, fresh HTTP status and floor/switch configuration. Metadata inspection performs only reads. Successful explicit user-session activation is durably audited and resumes the runtime, which may issue safety OFF/fence and honor configured intent. Does not deploy scripts or certify physical equipment.',
		operationId: 'verify-devices-virtual-plugin-thermostat-installation',
	})
	@ApiSuccessResponse(ThermostatInstallationResponseModel, 'Installation diagnostics')
	@ApiNotFoundResponse('Thermostat claim or installation not found.')
	@Post(':claim/verify')
	async verify(
		@Param('claim', new ParseUUIDPipe({ version: '4' })) claim: string,
		@Body() dto: ThermostatInstallationRevisionDto,
		@Req() req: AuthenticatedRequest,
	): Promise<ThermostatInstallationResponseModel> {
		const actor = this.actor(req);
		try {
			await this.loader.verify(claim, dto.expected_revision, actor);
		} catch (error) {
			if (error instanceof EntityNotFoundError)
				throw new NotFoundException('Thermostat claim or installation not found.');
			throw error;
		}
		return this.response(claim);
	}
	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Revoke installation',
		description:
			'CAS revoke ON eligibility before persisting revocation. Requests runtime safety release, retains ownership and never fabricates OFF/drain proof. A rejected change leaves prior stored activation intact; reload the current profile and retry. Only the running process remains conservatively paused after failure.',
		operationId: 'revoke-devices-virtual-plugin-thermostat-installation',
	})
	@ApiSuccessResponse(ThermostatInstallationResponseModel, 'Revoked installation')
	@ApiNotFoundResponse('Thermostat claim or installation not found.')
	@Post(':claim/revoke')
	async revoke(
		@Param('claim', new ParseUUIDPipe({ version: '4' })) claim: string,
		@Body() dto: ThermostatInstallationRevisionDto,
		@Req() req: AuthenticatedRequest,
	): Promise<ThermostatInstallationResponseModel> {
		const actor = this.actor(req);
		try {
			await this.profiles.revoke(claim, dto.expected_revision, actor);
		} catch (error) {
			if (error instanceof EntityNotFoundError)
				throw new NotFoundException('Thermostat claim or installation not found.');
			throw error;
		}
		return this.response(claim);
	}
	private actor(req: AuthenticatedRequest): string {
		const auth = req.auth;
		if (![UserRole.OWNER, UserRole.ADMIN].includes(auth?.role))
			throw new ForbiddenException('Owner or administrator commissioning role required.');
		if (auth?.type === 'user' && auth.id) return auth.id;
		throw new ForbiddenException(
			'An identified owner or administrator user session is required; API tokens cannot commission equipment.',
		);
	}
	private async response(claim: string): Promise<ThermostatInstallationResponseModel> {
		const response = new ThermostatInstallationResponseModel();
		response.data = Object.assign(new ThermostatInstallationModel(), await this.profiles.inspect(claim));
		return response;
	}
}
