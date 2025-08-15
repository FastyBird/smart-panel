import { Expose } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class NetworkStatsDto {
	@Expose()
	@IsString()
	interface: string;

	@Expose()
	@IsNumber()
	rx_bytes: number;

	@Expose()
	@IsNumber()
	tx_bytes: number;
}
