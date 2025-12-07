import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';

import { DisplaysController } from './controllers/displays.controller';
import { RegistrationController } from './controllers/registration.controller';
import { DisplayEntity } from './entities/displays.entity';
import { DisplaysService } from './services/displays.service';
import { DisplaysModuleResetService } from './services/module-reset.service';
import { RegistrationService } from './services/registration.service';
import { DisplayExistsConstraint } from './validators/display-exists-constraint.validator';

@Module({
	imports: [TypeOrmModule.forFeature([DisplayEntity]), AuthModule],
	controllers: [DisplaysController, RegistrationController],
	providers: [DisplaysService, RegistrationService, DisplaysModuleResetService, DisplayExistsConstraint],
	exports: [DisplaysService, DisplaysModuleResetService, DisplayExistsConstraint],
})
export class DisplaysModule {}
