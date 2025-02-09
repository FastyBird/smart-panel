import { IsObject, IsString } from 'class-validator';

export class CommandMessageDto {
	@IsString()
	event: string;

	@IsObject()
	payload: object;
}
