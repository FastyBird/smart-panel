import { Expose } from 'class-transformer';
import { IsArray, IsNumber, IsString } from 'class-validator';

export class WifiNetworksDto {
	@Expose()
	@IsString()
	ssid: string;

	@Expose()
	@IsString()
	bssid: string;

	@Expose()
	@IsString()
	mode: string;

	@Expose()
	@IsNumber()
	channel: number;

	@Expose()
	@IsNumber()
	frequency: number;

	@Expose()
	@IsNumber()
	signal_level: number;

	@Expose()
	@IsNumber()
	quality: number;

	@Expose()
	@IsArray()
	security: string[];

	@Expose()
	@IsArray()
	wpa_flags: string[];

	@Expose()
	@IsArray()
	rsn_flags: string[];
}
