import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class CheckResponseDto {
	@Expose()
	@IsBoolean()
	valid: boolean;
}
