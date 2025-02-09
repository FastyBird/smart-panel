import { IsNumber, IsString } from 'class-validator';

export class NetworkStatsDto {
	@IsString()
	interface: string;

	@IsNumber()
	rxBytes: number;

	@IsNumber()
	txBytes: number;
}
