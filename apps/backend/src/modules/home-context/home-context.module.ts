import { Module } from '@nestjs/common';

import { DevicesModule } from '../devices/devices.module';
import { EnergyModule } from '../energy/energy.module';
import { ScenesModule } from '../scenes/scenes.module';
import { SecurityModule } from '../security/security.module';
import { SpacesModule } from '../spaces/spaces.module';
import { WeatherModule } from '../weather/weather.module';

import { HomeContextQueryService } from './services/home-context-query.service';
import { HomeStateQueryService } from './services/home-state-query.service';

@Module({
	imports: [DevicesModule, EnergyModule, ScenesModule, SecurityModule, SpacesModule, WeatherModule],
	providers: [HomeContextQueryService, HomeStateQueryService],
	exports: [HomeContextQueryService, HomeStateQueryService],
})
export class HomeContextModule {}
