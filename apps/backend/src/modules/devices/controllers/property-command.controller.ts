import { Body, Controller, ForbiddenException, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { TokenOwnerType } from '../../auth/auth.constants';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { ApiSuccessResponse } from '../../swagger/decorators/api-documentation.decorator';
import { UserRole } from '../../users/users.constants';
import { DEVICES_MODULE_API_TAG_NAME } from '../devices.constants';
import { PropertyCommandDto } from '../dto/property-command.dto';
import { PropertyCommandResponseModel, PropertyCommandResultModel } from '../models/property-command-response.model';
import { PropertyCommandService } from '../services/property-command.service';

@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('property-commands')
export class PropertyCommandController {
	constructor(private readonly commands: PropertyCommandService) {}

	@ApiOperation({
		tags: [DEVICES_MODULE_API_TAG_NAME],
		summary: 'Execute a correlated property command batch',
		description:
			'Uses ordinary core target admission, composite expansion and convergence. Returns terminal member outcomes without splitting compound colors into separate requests.',
		operationId: 'execute-devices-module-property-command',
	})
	@ApiSuccessResponse(PropertyCommandResponseModel, 'Terminal correlated command result')
	@Post()
	@HttpCode(200)
	async execute(
		@Req() req: AuthenticatedRequest,
		@Body() dto: PropertyCommandDto,
	): Promise<PropertyCommandResponseModel> {
		const auth = req.auth;
		const display = auth?.type === 'token' && auth.ownerType === TokenOwnerType.DISPLAY;
		const administrator = !!auth && (auth.role === UserRole.ADMIN || auth.role === UserRole.OWNER);
		if (!display && !administrator) throw new ForbiddenException('This action is not allowed for this caller');
		const result = await this.commands.executePropertyCommands(
			dto.properties.map((target) => ({
				propertyId: target.property,
				value: target.value,
				requestedDeviceId: target.device,
				requestedChannelId: target.channel,
			})),
			{
				requestId: dto.request_id,
				context: {
					origin: dto.context?.origin ?? (display ? 'panel.device' : 'admin'),
					displayId: display && auth.type === 'token' ? (auth.ownerId ?? undefined) : dto.context?.display_id,
					spaceId: dto.context?.space_id,
					roleKey: dto.context?.role_key,
					extra: dto.context?.extra,
				},
			},
		);
		const composites = [
			...new Map(
				result.results.filter((target) => target.composite).map((target) => [target.composite.id, target.composite]),
			).values(),
		];
		const response = new PropertyCommandResponseModel();
		response.data = Object.assign(new PropertyCommandResultModel(), {
			request_id: dto.request_id,
			success: result.success,
			results: result.results,
			composites,
		});
		return response;
	}
}
