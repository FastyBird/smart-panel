import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { GO2RTC_MODES, Go2rtcMode } from '../cameras.constants';
import { Go2rtcRelayReason, Go2rtcRelayState } from '../services/go2rtc.service';

// Records keep both lists exhaustive: a state or reason added to Go2rtcService fails to compile until listed here.
const RELAY_STATES_BY_NAME: Record<Go2rtcRelayState, true> = {
	disabled: true,
	starting: true,
	running: true,
	unavailable: true,
	error: true,
};

const RELAY_REASONS_BY_NAME: Record<Go2rtcRelayReason, true> = {
	mode_disabled: true,
	module_disabled: true,
	binary_path_invalid: true,
	binary_missing: true,
	binary_not_executable: true,
	external_url_missing: true,
	external_unreachable: true,
	start_timeout: true,
	port_in_use: true,
	crashed: true,
};

export const GO2RTC_RELAY_STATES = Object.keys(RELAY_STATES_BY_NAME) as Go2rtcRelayState[];
export const GO2RTC_RELAY_REASONS = Object.keys(RELAY_REASONS_BY_NAME) as Go2rtcRelayReason[];

@ApiSchema({ name: 'CamerasModuleDataRelayStatus' })
export class CamerasRelayStatusModel {
	@ApiProperty({ description: 'Configured relay mode', enum: GO2RTC_MODES, example: 'managed' })
	@Expose()
	mode: Go2rtcMode;

	@ApiProperty({ description: 'Current relay state', enum: GO2RTC_RELAY_STATES, example: 'running' })
	@Expose()
	state: Go2rtcRelayState;

	@ApiProperty({
		description: 'Why the relay is not running; null while it is running or starting',
		enum: GO2RTC_RELAY_REASONS,
		nullable: true,
	})
	@Expose()
	reason: Go2rtcRelayReason | null;

	@ApiProperty({
		description: 'go2rtc version while the relay is running',
		type: 'string',
		nullable: true,
		example: '1.9.9',
	})
	@Expose()
	version: string | null;
}

@ApiSchema({ name: 'CamerasModuleDataSessionsStatus' })
export class CamerasSessionsStatusModel {
	@ApiProperty({ description: 'Live sockets currently open', type: 'integer', example: 2 })
	@Expose()
	active: number;

	@ApiProperty({ description: 'Configured maximum of live sockets', type: 'integer', example: 8 })
	@Expose()
	max: number;

	@ApiProperty({
		name: 'max_per_camera',
		description: 'Configured maximum of live sockets per camera',
		type: 'integer',
		example: 4,
	})
	@Expose({ name: 'max_per_camera' })
	maxPerCamera: number;
}

@ApiSchema({ name: 'CamerasModuleDataStatus' })
export class CamerasStatusModel {
	@ApiProperty({ description: 'Live view relay status', type: () => CamerasRelayStatusModel })
	@Expose()
	relay: CamerasRelayStatusModel;

	@ApiProperty({ description: 'Live socket usage', type: () => CamerasSessionsStatusModel })
	@Expose()
	sessions: CamerasSessionsStatusModel;
}

@ApiSchema({ name: 'CamerasModuleResStatus' })
export class CamerasStatusResponseModel extends BaseSuccessResponseModel<CamerasStatusModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CamerasStatusModel,
	})
	@Expose()
	declare data: CamerasStatusModel;
}
