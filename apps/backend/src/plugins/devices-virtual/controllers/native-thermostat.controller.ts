import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import {
	ApiCreatedSuccessResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import {
	CreateNativeThermostatDto,
	ReleaseNativeThermostatDto,
	RequestNativeThermostatDto,
	UpdateNativeThermostatDto,
} from '../dto/native-thermostat.dto';
import {
	NativeClimateCandidatesResponseModel,
	NativeThermostatResponseModel,
} from '../models/native-thermostat-response.model';
import { NativeThermostatService } from '../services/native-thermostat.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers/thermostats/native')
export class NativeThermostatController {
	constructor(private readonly native: NativeThermostatService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'List native climate units',
		description: 'List current supported adopted native climate units and reservation diagnostics.',
		operationId: 'get-devices-virtual-plugin-native-climate-candidates',
	})
	@ApiSuccessResponse(NativeClimateCandidatesResponseModel, 'Native climate units')
	@Get('candidates')
	async candidates(): Promise<NativeClimateCandidatesResponseModel> {
		const response = new NativeClimateCandidatesResponseModel();
		response.data = await this.native.candidates();
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview native thermostat',
		description: 'Validate native binding without catalog writes or physical commands.',
		operationId: 'preview-devices-virtual-plugin-native-thermostat',
	})
	@ApiCreatedSuccessResponse(NativeThermostatResponseModel, 'Native thermostat preview')
	@Post('draft-preview')
	async preview(@Body() dto: CreateNativeThermostatDto): Promise<NativeThermostatResponseModel> {
		return this.response(() => this.native.preview(dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Create native thermostat',
		description:
			'Create a virtual climate controller bound exclusively to one native unit. Creation sends no physical request.',
		operationId: 'create-devices-virtual-plugin-native-thermostat',
	})
	@ApiCreatedSuccessResponse(NativeThermostatResponseModel, 'Native thermostat created')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post()
	async create(@Body() dto: CreateNativeThermostatDto): Promise<NativeThermostatResponseModel> {
		return this.response(() => this.native.create(dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Read native thermostat',
		description: 'Read durable requested settings separately from current provider observations and request outcomes.',
		operationId: 'get-devices-virtual-plugin-native-thermostat',
	})
	@ApiSuccessResponse(NativeThermostatResponseModel, 'Native thermostat')
	@Get(':id')
	async get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<NativeThermostatResponseModel> {
		return this.response(() => this.native.get(id));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Revalidate native binding',
		description:
			'Explicitly revalidate the same canonical native unit after provider capability changes. Physical remapping is refused.',
		operationId: 'update-devices-virtual-plugin-native-thermostat',
	})
	@ApiSuccessResponse(NativeThermostatResponseModel, 'Native thermostat')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Put(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: UpdateNativeThermostatDto,
	): Promise<NativeThermostatResponseModel> {
		return this.response(() => this.native.update(id, dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Request native thermostat settings',
		description:
			'Validate and durably journal one explicit patch before transport. Acceptance and observed matches never imply physical confirmation. Duplicate request identities never replay.',
		operationId: 'request-devices-virtual-plugin-native-thermostat',
	})
	@ApiCreatedSuccessResponse(NativeThermostatResponseModel, 'Requested native thermostat')
	@Post(':id/requests')
	async request(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: RequestNativeThermostatDto,
	): Promise<NativeThermostatResponseModel> {
		return this.response(() => this.native.request(id, dto));
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Release native thermostat binding',
		description:
			'Revoke native request admission, join original enrolled attempts and release the Smart Panel reservation. No OFF command or physical completion proof is implied. History is retained.',
		operationId: 'release-devices-virtual-plugin-native-thermostat',
	})
	@ApiCreatedSuccessResponse(NativeThermostatResponseModel, 'Released native thermostat binding')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post(':id/release')
	async release(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() dto: ReleaseNativeThermostatDto,
	): Promise<NativeThermostatResponseModel> {
		return this.response(() => this.native.release(id, dto));
	}

	private async response(
		operation: () => Promise<NativeThermostatResponseModel['data'] | null>,
	): Promise<NativeThermostatResponseModel> {
		try {
			const data = await operation();
			if (!data) throw new NotFoundException('Native thermostat does not exist.');
			const response = new NativeThermostatResponseModel();
			response.data = data;
			return response;
		} catch (error) {
			if (error instanceof DevicesValidationException) throw new UnprocessableEntityException(error.message);
			throw error;
		}
	}
}
