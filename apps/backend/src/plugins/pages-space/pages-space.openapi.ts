import { CreateSpacePageDto } from './dto/create-page.dto';
import { UpdateSpacePageDto } from './dto/update-page.dto';
import { SpacePageEntity } from './entities/pages-space.entity';

export const PAGES_SPACE_PLUGIN_SWAGGER_EXTRA_MODELS = [SpacePageEntity, CreateSpacePageDto, UpdateSpacePageDto];
