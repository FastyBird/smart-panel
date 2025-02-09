import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisteredDisplayResponseDto {
	@Expose()
	@IsNotEmpty()
	@IsString()
	secret: string;
}
