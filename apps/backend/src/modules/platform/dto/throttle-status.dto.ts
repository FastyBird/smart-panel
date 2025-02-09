import { IsBoolean } from 'class-validator';

export class ThrottleStatusDto {
	@IsBoolean()
	undervoltage: boolean;

	@IsBoolean()
	frequencyCapping: boolean;

	@IsBoolean()
	throttling: boolean;

	@IsBoolean()
	softTempLimit: boolean;
}
