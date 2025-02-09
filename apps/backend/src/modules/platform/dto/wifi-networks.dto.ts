import { IsArray, IsNumber, IsString } from 'class-validator';

export class WifiNetworksDto {
	@IsString()
	ssid: string;

	@IsString()
	bssid: string;

	@IsString()
	mode: string;

	@IsNumber()
	channel: number;

	@IsNumber()
	frequency: number;

	@IsNumber()
	signalLevel: number;

	@IsNumber()
	quality: number;

	@IsArray()
	security: string[];

	@IsArray()
	wpaFlags: string[];

	@IsArray()
	rsnFlags: string[];
}
