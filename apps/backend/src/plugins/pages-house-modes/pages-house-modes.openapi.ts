import { CreateHouseModesPageDto } from './dto/create-page.dto';
import { UpdateHouseModesPageDto } from './dto/update-page.dto';
import { HouseModesPageEntity } from './entities/pages-house-modes.entity';

export const PAGES_HOUSE_MODES_PLUGIN_SWAGGER_EXTRA_MODELS = [
	HouseModesPageEntity,
	CreateHouseModesPageDto,
	UpdateHouseModesPageDto,
];
