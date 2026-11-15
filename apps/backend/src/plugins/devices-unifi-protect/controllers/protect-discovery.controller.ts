import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME } from '../devices-unifi-protect.constants';
import { ProtectProbeRequestDto } from '../dto/protect-discovery-probe.dto';
import {
	ProtectDiscoveredConsoleModel,
	ProtectDiscoveryInterfaceModel,
	ProtectDiscoveryModel,
	ProtectDiscoveryResponseModel,
	ProtectProbeCertificateModel,
	ProtectProbeModel,
	ProtectProbeResponseModel,
} from '../models/protect-discovery.model';
import { ProtectDiscoveryProbeService, ProtectProbeResult } from '../services/protect-discovery-probe.service';
import { PROTECT_PROBE_DEFAULT_PORT } from '../services/protect-discovery.constants';
import { ProtectDiscoveryScan, ProtectDiscoveryService } from '../services/protect-discovery.service';

const toProbeModel = (result: ProtectProbeResult): ProtectProbeModel =>
	Object.assign(new ProtectProbeModel(), {
		...result,
		certificate:
			result.certificate === null ? null : Object.assign(new ProtectProbeCertificateModel(), result.certificate),
	});

const toDiscoveryModel = (scan: ProtectDiscoveryScan): ProtectDiscoveryModel =>
	Object.assign(new ProtectDiscoveryModel(), {
		...scan,
		warnings: [...scan.warnings],
		interfaces: scan.interfaces.map((iface) => Object.assign(new ProtectDiscoveryInterfaceModel(), iface)),
		consoles: scan.consoles.map((console) =>
			Object.assign(new ProtectDiscoveredConsoleModel(), {
				...console,
				addresses: [...console.addresses],
				probe: toProbeModel(console.probe),
			}),
		),
	});

@ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME)
@Controller('discovery')
export class ProtectDiscoveryController {
	constructor(
		private readonly discovery: ProtectDiscoveryService,
		private readonly probe: ProtectDiscoveryProbeService,
	) {}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Get the last UniFi Protect discovery result',
		description:
			'Returns the result of the last local network scan for UniFi OS consoles, or an idle result when no scan has run.',
		operationId: 'get-devices-unifi-protect-plugin-discovery',
	})
	@ApiSuccessResponse(ProtectDiscoveryResponseModel, 'Last UniFi Protect discovery result')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	getDiscovery(): ProtectDiscoveryResponseModel {
		const response = new ProtectDiscoveryResponseModel();
		response.data = toDiscoveryModel(this.discovery.getLastScan());

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Scan the local network for UniFi Protect consoles',
		description:
			'Broadcasts a UniFi discovery request on the local network, probes the consoles that reply without credentials and returns the finished result. Concurrent requests share one scan. The call waits for the 5 second scan window plus the candidate probes, each trying up to 3 of its addresses in turn (worst case about 53 seconds).',
		operationId: 'scan-devices-unifi-protect-plugin-discovery',
	})
	@ApiSuccessResponse(ProtectDiscoveryResponseModel, 'UniFi Protect discovery scan completed')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('scan')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async scanDiscovery(): Promise<ProtectDiscoveryResponseModel> {
		const response = new ProtectDiscoveryResponseModel();
		response.data = toDiscoveryModel(await this.discovery.scan());

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME],
		summary: 'Probe a host for UniFi Protect',
		description:
			'Checks without credentials whether the host is a UniFi OS console running Protect. An unreachable host is reported in the result, not as an error.',
		operationId: 'probe-devices-unifi-protect-plugin-discovery',
	})
	@ApiBody({ type: ProtectProbeRequestDto })
	@ApiSuccessResponse(ProtectProbeResponseModel, 'UniFi Protect probe completed')
	@ApiBadRequestResponse('Invalid host or port')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('probe')
	@HttpCode(200)
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	async probeHost(@Body() body: ProtectProbeRequestDto): Promise<ProtectProbeResponseModel> {
		const result = await this.probe.probe({
			host: body.data.host,
			port: body.data.port ?? PROTECT_PROBE_DEFAULT_PORT,
		});

		const response = new ProtectProbeResponseModel();
		response.data = toProbeModel(result);

		return response;
	}
}
