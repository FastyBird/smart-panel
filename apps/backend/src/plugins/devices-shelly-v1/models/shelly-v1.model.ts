import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class ShellyV1DeviceInfoModel {
	@Expose()
	@IsString()
	id: string;

	@Expose()
	@IsOptional()
	@IsString()
	name: string | null = null;

	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsString()
	mac: string;

	@Expose()
	@IsString()
	host: string;

	@Expose()
	@IsOptional()
	@IsString()
	firmware: string | null = null;

	@Expose()
	@IsOptional()
	@IsBoolean()
	auth: boolean = false;

	@Expose()
	@IsOptional()
	@IsBoolean()
	online: boolean = false;
}

export class ShellyV1ComponentModel {
	@Expose()
	@IsString()
	type: string;

	@Expose()
	@IsInt()
	id: number;
}

export class ShellyV1RelayStateModel {
	@Expose()
	@IsBoolean()
	ison: boolean;

	@Expose()
	@IsOptional()
	@IsBoolean()
	hasTimer?: boolean;

	@Expose()
	@IsOptional()
	@IsInt()
	timerRemaining?: number;
}

export class ShellyV1MeterStateModel {
	@Expose()
	@IsOptional()
	power?: number;

	@Expose()
	@IsOptional()
	total?: number;

	@Expose()
	@IsOptional()
	timestamp?: number;
}

export class ShellyV1TemperatureStateModel {
	@Expose()
	@IsOptional()
	tC?: number;

	@Expose()
	@IsOptional()
	tF?: number;
}

export class ShellyV1HumidityStateModel {
	@Expose()
	@IsOptional()
	value?: number;
}
