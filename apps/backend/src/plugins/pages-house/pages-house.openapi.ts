import { CreateHousePageDto } from './dto/create-page.dto';
import { UpdateHousePageDto } from './dto/update-page.dto';
import { HousePageEntity } from './entities/pages-house.entity';

export const PAGES_HOUSE_PLUGIN_SWAGGER_EXTRA_MODELS = [HousePageEntity, CreateHousePageDto, UpdateHousePageDto];
