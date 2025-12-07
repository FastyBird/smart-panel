# Refactoring Plan: Unified Displays Module (v4)

## Executive Summary

Create a new `displays` module with a **single unified entity** that is completely independent from users. Modify the auth module's `LongLiveTokenEntity` to support multiple owner types via a simple ID reference (no foreign key), while keeping direct entity relations only for access/refresh tokens.

---

## Key Architecture Principles

### 1. Token Ownership Model

| Token Type | Owner Relation | Use Case |
|------------|----------------|----------|
| **AccessToken** | Direct FK to `UserEntity` | User session authentication |
| **RefreshToken** | Direct FK to `UserEntity` | User token refresh |
| **LongLiveToken** | Plain UUID + owner type | Displays, third-party APIs, integrations |

### 2. Long-Live Token Flexibility

```typescript
// LongLiveTokenEntity (updated)
@Column({ type: 'varchar' })
ownerType: TokenOwnerType;     // 'user' | 'display' | 'third_party'

@Column({ type: 'uuid', nullable: true })
ownerId: string | null;        // Plain ID, no FK constraint

// Examples:
// - Display token: { ownerType: 'display', ownerId: <display.id> }
// - User API token: { ownerType: 'user', ownerId: <user.id> }
// - Third-party token: { ownerType: 'third_party', ownerId: null }
```

### 3. Complete Separation
- **No `UserRole.DISPLAY`** - Remove entirely
- **No user relation in DisplayEntity** - Displays are standalone
- **Display settings in entity** - Not in config file

---

## Current vs Target State

### Token Entity Changes

```typescript
// CURRENT: LongLiveTokenEntity
@ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
owner: UserEntity;  // Direct FK relation

// TARGET: LongLiveTokenEntity
@Column({ type: 'varchar', default: TokenOwnerType.USER })
ownerType: TokenOwnerType;

@Column({ type: 'uuid', nullable: true })
ownerId: string | null;  // Plain ID, no FK
```

### Files to Modify

| File | Change |
|------|--------|
| `auth/auth.constants.ts` | Add `TokenOwnerType` enum |
| `auth/entities/auth.entity.ts` | Update `LongLiveTokenEntity` |
| `auth/dto/create-token.dto.ts` | Add `ownerType`, `ownerId` to DTO |
| `auth/services/tokens.service.ts` | Update token queries |
| `auth/guards/auth.guard.ts` | Support display token validation |
| `users/users.constants.ts` | Remove `UserRole.DISPLAY` |
| `config/config.constants.ts` | Remove `SectionType.DISPLAY` |
| `config/models/config.model.ts` | Remove `DisplayConfigModel` |

---

## Implementation Details

### Phase 1: Update Auth Module

#### 1.1 Add Token Owner Type (`auth.constants.ts`)

```typescript
export enum TokenOwnerType {
  USER = 'user',
  DISPLAY = 'display',
  THIRD_PARTY = 'third_party',
}
```

#### 1.2 Update LongLiveTokenEntity (`entities/auth.entity.ts`)

```typescript
@ApiSchema({ name: 'AuthModuleDataLongLiveToken' })
@ChildEntity()
export class LongLiveTokenEntity extends TokenEntity {
  @ApiProperty({
    name: 'owner_type',
    description: 'Type of token owner',
    enum: TokenOwnerType,
    example: TokenOwnerType.USER,
  })
  @Expose({ name: 'owner_type' })
  @IsEnum(TokenOwnerType)
  @Column({ type: 'varchar', default: TokenOwnerType.USER })
  ownerType: TokenOwnerType;

  @ApiPropertyOptional({
    name: 'owner_id',
    description: 'Owner entity ID (user, display, or null for third-party)',
    type: 'string',
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose({ name: 'owner_id' })
  @IsOptional()
  @IsUUID('4')
  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  @ApiProperty({
    description: 'Token name',
    type: 'string',
    example: 'My API Token',
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  @Column()
  name: string;

  @ApiProperty({
    description: 'Token description',
    type: 'string',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @Column({ nullable: true })
  description: string | null;

  @Expose()
  get type(): TokenType {
    return TokenType.LONG_LIVE;
  }
}
```

#### 1.3 Update CreateLongLiveTokenDto (`dto/create-token.dto.ts`)

```typescript
@ApiSchema({ name: 'AuthModuleCreateLongLiveToken' })
export class CreateLongLiveTokenDto extends CreateTokenDto {
  @ApiProperty({
    description: 'Token type',
    enum: [TokenType.LONG_LIVE],
    example: TokenType.LONG_LIVE,
  })
  type: TokenType.LONG_LIVE;

  @ApiProperty({
    name: 'owner_type',
    description: 'Type of token owner',
    enum: TokenOwnerType,
    example: TokenOwnerType.USER,
  })
  @Expose({ name: 'owner_type' })
  @IsEnum(TokenOwnerType)
  ownerType: TokenOwnerType;

  @ApiPropertyOptional({
    name: 'owner_id',
    description: 'Owner entity ID',
    type: 'string',
    format: 'uuid',
    nullable: true,
  })
  @Expose({ name: 'owner_id' })
  @IsOptional()
  @IsUUID('4')
  @ValidateIf((_, value) => value !== null)
  ownerId: string | null;

  @ApiProperty({
    description: 'Token name',
    type: 'string',
    example: 'My API Token',
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Token description',
    type: 'string',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== null)
  description: string | null;
}
```

#### 1.4 Update Auth Guard (`guards/auth.guard.ts`)

```typescript
// New types for authenticated entities
export interface AuthenticatedUser {
  type: 'user';
  id: string;
  role: UserRole;
}

export interface AuthenticatedDisplay {
  type: 'display';
  id: string;
}

export interface AuthenticatedThirdParty {
  type: 'third_party';
  tokenId: string;
}

export type AuthenticatedEntity = AuthenticatedUser | AuthenticatedDisplay | AuthenticatedThirdParty;

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedEntity;
}

// In canActivate method, add long-live token handling:
private async validateLongLiveToken(token: string): Promise<AuthenticatedEntity | null> {
  try {
    const payload = await this.jwtService.verifyAsync(token);
    
    // Find token in database
    const tokenEntity = await this.tokensService.findByHashedToken<LongLiveTokenEntity>(
      token,
      LongLiveTokenEntity,
    );

    if (!tokenEntity || tokenEntity.revoked) {
      return null;
    }

    // Check expiration
    if (tokenEntity.expiresAt && tokenEntity.expiresAt < new Date()) {
      return null;
    }

    switch (tokenEntity.ownerType) {
      case TokenOwnerType.DISPLAY:
        if (!tokenEntity.ownerId) return null;
        return { type: 'display', id: tokenEntity.ownerId };

      case TokenOwnerType.USER:
        if (!tokenEntity.ownerId) return null;
        const user = await this.usersService.findOne(tokenEntity.ownerId);
        if (!user) return null;
        return { type: 'user', id: user.id, role: user.role };

      case TokenOwnerType.THIRD_PARTY:
        return { type: 'third_party', tokenId: tokenEntity.id };

      default:
        return null;
    }
  } catch {
    return null;
  }
}
```

#### 1.5 Add Token Query Methods (`services/tokens.service.ts`)

```typescript
async findByOwnerId(
  ownerId: string,
  ownerType: TokenOwnerType,
): Promise<LongLiveTokenEntity[]> {
  return this.dataSource.getRepository(LongLiveTokenEntity).find({
    where: { ownerId, ownerType },
  });
}

async findAllByOwnerType(ownerType: TokenOwnerType): Promise<LongLiveTokenEntity[]> {
  return this.dataSource.getRepository(LongLiveTokenEntity).find({
    where: { ownerType },
  });
}

async revokeByOwnerId(ownerId: string, ownerType: TokenOwnerType): Promise<void> {
  await this.dataSource.getRepository(LongLiveTokenEntity).update(
    { ownerId, ownerType },
    { revoked: true },
  );
}
```

### Phase 2: Update Users Module

#### 2.1 Remove DISPLAY Role (`users.constants.ts`)

```typescript
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  USER = 'user',
  // DISPLAY - REMOVED
}
```

#### 2.2 Cleanup Users Module

Remove:
- `DisplayInstanceEntity` from `users.entity.ts`
- `DisplaysInstancesService` and controller
- `SystemDisplayEntitySubscriber`
- Display-related DTOs and response models
- Display events from `EventType` enum

### Phase 3: Update System Module

Remove:
- `DisplayProfileEntity` from `system.entity.ts`
- `DisplaysProfilesService` and controller
- Display-related DTOs, validators, response models
- Display events from `EventType` enum

### Phase 4: Update Config Module

#### 4.1 Remove Display Section (`config.constants.ts`)

```typescript
export enum SectionType {
  AUDIO = 'audio',
  // DISPLAY - REMOVED
  LANGUAGE = 'language',
  WEATHER = 'weather',
  SYSTEM = 'system',
}
```

#### 4.2 Remove DisplayConfigModel (`config.model.ts`)

- Remove `DisplayConfigModel` class
- Remove `display` property from `AppConfigModel`

### Phase 5: Create Displays Module

#### 5.1 Module Structure

```
apps/backend/src/modules/displays/
├── controllers/
│   ├── displays.controller.ts
│   ├── displays.controller.spec.ts
│   ├── registration.controller.ts
│   └── registration.controller.spec.ts
├── dto/
│   ├── register-display.dto.ts
│   └── update-display.dto.ts
├── entities/
│   └── displays.entity.ts
├── models/
│   └── displays-response.model.ts
├── services/
│   ├── displays.service.ts
│   ├── displays.service.spec.ts
│   ├── registration.service.ts
│   ├── registration.service.spec.ts
│   └── module-reset.service.ts
├── validators/
│   └── display-exists-constraint.validator.ts
├── displays.constants.ts
├── displays.exceptions.ts
├── displays.module.ts
└── displays.openapi.ts
```

#### 5.2 DisplayEntity (`entities/displays.entity.ts`)

```typescript
@ApiSchema({ name: 'DisplaysModuleDataDisplay' })
@Entity('displays_module_displays')
export class DisplayEntity extends BaseEntity {
  // === Identity ===
  @Column({ type: 'uuid', unique: true })
  uid: string;

  @Column()
  mac: string;

  // === Software ===
  @Column()
  version: string;

  @Column()
  build: string;

  // === Screen ===
  @Column({ type: 'int', nullable: true })
  screenWidth: number | null;

  @Column({ type: 'int', nullable: true })
  screenHeight: number | null;

  @Column({ type: 'float', nullable: true })
  pixelRatio: number | null;

  // === Grid ===
  @Column({ type: 'float', nullable: true })
  unitSize: number | null;

  @Column({ type: 'int', nullable: true })
  rows: number | null;

  @Column({ type: 'int', nullable: true })
  cols: number | null;

  @Column({ type: 'boolean', default: false })
  primary: boolean;

  // === Settings (from config) ===
  @Column({ type: 'boolean', default: false })
  darkMode: boolean;

  @Column({ type: 'int', default: 100 })
  brightness: number;  // 0-100

  @Column({ type: 'int', default: 30 })
  screenLockDuration: number;  // seconds

  @Column({ type: 'boolean', default: true })
  screenSaver: boolean;

  // === Activity ===
  @Column({ type: 'datetime', nullable: true })
  lastSeenAt: Date | null;
}
```

#### 5.3 Registration Service (`services/registration.service.ts`)

```typescript
@Injectable()
export class RegistrationService {
  constructor(
    private readonly displaysService: DisplaysService,
    private readonly tokensService: TokensService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  validateUserAgent(userAgent: string | undefined): boolean {
    if (!userAgent) return false;
    return ALLOWED_USER_AGENTS.some(agent => userAgent.includes(agent));
  }

  async register(dto: RegisterDisplayDto): Promise<RegistrationResult> {
    // 1. Find or create display
    let display = await this.displaysService.findByUid(dto.uid);
    const isNew = !display;

    if (display) {
      display = await this.displaysService.update(display.id, {
        mac: dto.mac,
        version: dto.version,
        build: dto.build,
        screenWidth: dto.screen_width ?? display.screenWidth,
        screenHeight: dto.screen_height ?? display.screenHeight,
        pixelRatio: dto.pixel_ratio ?? display.pixelRatio,
        unitSize: dto.unit_size ?? display.unitSize,
        rows: dto.rows ?? display.rows,
        cols: dto.cols ?? display.cols,
        lastSeenAt: new Date(),
      });
    } else {
      const existingDisplays = await this.displaysService.findAll();
      
      display = await this.displaysService.create({
        uid: dto.uid,
        mac: dto.mac,
        version: dto.version,
        build: dto.build,
        screenWidth: dto.screen_width ?? null,
        screenHeight: dto.screen_height ?? null,
        pixelRatio: dto.pixel_ratio ?? null,
        unitSize: dto.unit_size ?? null,
        rows: dto.rows ?? null,
        cols: dto.cols ?? null,
        primary: existingDisplays.length === 0,
        lastSeenAt: new Date(),
      });
    }

    // 2. Revoke any existing tokens for this display
    await this.tokensService.revokeByOwnerId(display.id, TokenOwnerType.DISPLAY);

    // 3. Generate new long-lived token
    const accessToken = await this.generateDisplayToken(display);

    this.eventEmitter.emit(
      isNew ? EventType.DISPLAY_CREATED : EventType.DISPLAY_REGISTERED,
      display,
    );

    return { display, accessToken };
  }

  private async generateDisplayToken(display: DisplayEntity): Promise<string> {
    const payload = {
      sub: display.id,
      type: 'display',
      iat: Math.floor(Date.now() / 1000),
    };

    // Long expiration (10 years)
    const token = this.jwtService.sign(payload, { expiresIn: '3650d' });

    await this.tokensService.create<LongLiveTokenEntity, CreateLongLiveTokenDto>({
      token,
      type: TokenType.LONG_LIVE,
      ownerType: TokenOwnerType.DISPLAY,
      ownerId: display.id,
      name: `Display ${display.uid}`,
      description: `Auto-generated token for display ${display.uid}`,
      expiresAt: null,
    });

    return token;
  }
}
```

#### 5.4 Registration Controller (`controllers/registration.controller.ts`)

```typescript
@ApiTags(DISPLAYS_MODULE_API_TAG_NAME)
@Controller('register')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @ApiOperation({
    summary: 'Register display device',
    description: 'Register a display and receive a long-lived access token',
    operationId: 'create-displays-module-register',
  })
  @ApiCreatedSuccessResponse(RegisterDisplayResponseModel, 'Display registered successfully')
  @ApiForbiddenResponse('Invalid User-Agent')
  @Public()
  @Post()
  async register(
    @Headers('User-Agent') userAgent: string,
    @Body() dto: ReqRegisterDisplayDto,
  ): Promise<RegisterDisplayResponseModel> {
    if (!this.registrationService.validateUserAgent(userAgent)) {
      throw new ForbiddenException('Access Denied');
    }

    const result = await this.registrationService.register(dto.data);

    const response = new RegisterDisplayResponseModel();
    response.data = {
      display: result.display,
      access_token: result.accessToken,
    };

    return response;
  }
}
```

### Phase 6: Token Management for Admins

Add endpoints for users to manage display tokens:

```typescript
// auth/controllers/tokens.controller.ts

@ApiOperation({
  summary: 'List display tokens',
  description: 'List all display tokens (for management/revocation)',
})
@ApiSuccessResponse(DisplayTokensResponseModel, 'Display tokens retrieved')
@Get('displays')
@Roles(UserRole.OWNER, UserRole.ADMIN)
async listDisplayTokens(): Promise<DisplayTokensResponseModel> {
  const tokens = await this.tokensService.findAllByOwnerType(TokenOwnerType.DISPLAY);
  
  const response = new DisplayTokensResponseModel();
  response.data = tokens.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    display_id: t.ownerId,
    revoked: t.revoked,
    created_at: t.createdAt,
  }));
  
  return response;
}

@ApiOperation({
  summary: 'Revoke display token',
  description: 'Revoke a display token (e.g., if compromised)',
})
@ApiNoContentResponse({ description: 'Token revoked' })
@Delete('displays/:id')
@HttpCode(204)
@Roles(UserRole.OWNER, UserRole.ADMIN)
async revokeDisplayToken(
  @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
): Promise<void> {
  const token = await this.tokensService.findOne<LongLiveTokenEntity>(id, LongLiveTokenEntity);
  
  if (!token || token.ownerType !== TokenOwnerType.DISPLAY) {
    throw new NotFoundException('Display token not found');
  }

  await this.tokensService.update(id, { revoked: true });
}
```

### Phase 7: Update WebSocket Authentication

```typescript
// websocket/services/ws-auth.service.ts

async authenticateClient(client: Socket): Promise<boolean> {
  const token = this.extractToken(client);
  if (!token) return false;

  // Try long-lived token first (displays)
  const longLiveAuth = await this.validateLongLiveToken(token);
  if (longLiveAuth) {
    client.data.auth = longLiveAuth;
    return true;
  }

  // Try access token (users)
  const accessAuth = await this.validateAccessToken(token);
  if (accessAuth) {
    client.data.auth = accessAuth;
    return true;
  }

  return false;
}

private async validateLongLiveToken(token: string): Promise<AuthenticatedEntity | null> {
  const tokenEntity = await this.tokensService.findByToken<LongLiveTokenEntity>(token);
  
  if (!tokenEntity || tokenEntity.revoked || tokenEntity.type !== TokenType.LONG_LIVE) {
    return null;
  }

  if (tokenEntity.ownerType === TokenOwnerType.DISPLAY && tokenEntity.ownerId) {
    return { type: 'display', id: tokenEntity.ownerId };
  }

  return null;
}
```

### Phase 8: Update Dashboard Module

The `PageEntity` has a `@ManyToOne` relation to `DisplayProfileEntity` that must be updated.

#### 8.1 Update Entity (`entities/dashboard.entity.ts`)

```typescript
// CURRENT
import { DisplayProfileEntity } from '../../system/entities/system.entity';

@Validate(AbstractInstanceValidator, [DisplayProfileEntity], {
  message: '[{"field":"display","reason":"Display must be a valid subclass of DisplayProfileEntity."}]',
})
@Transform(({ value }: { value: DisplayProfileEntity | null }) => value?.id ?? null, { toPlainOnly: true })
@ManyToOne(() => DisplayProfileEntity, { cascade: true, onDelete: 'CASCADE' })
@JoinColumn({ name: 'displayId' })
display: DisplayProfileEntity | string | null;

// TARGET
import { DisplayEntity } from '../../displays/entities/displays.entity';

@Validate(AbstractInstanceValidator, [DisplayEntity], {
  message: '[{"field":"display","reason":"Display must be a valid subclass of DisplayEntity."}]',
})
@Transform(({ value }: { value: DisplayEntity | null }) => value?.id ?? null, { toPlainOnly: true })
@ManyToOne(() => DisplayEntity, { cascade: true, onDelete: 'CASCADE' })
@JoinColumn({ name: 'displayId' })
display: DisplayEntity | string | null;
```

#### 8.2 Update Service (`services/pages.service.ts`)

```typescript
// CURRENT
import { DisplaysProfilesService } from '../../system/services/displays-profiles.service';

constructor(
  // ...
  private readonly displaysService: DisplaysProfilesService,
) {}

// TARGET
import { DisplaysService } from '../../displays/services/displays.service';

constructor(
  // ...
  private readonly displaysService: DisplaysService,
) {}
```

#### 8.3 Update DTOs

**`dto/create-page.dto.ts`**:
```typescript
// CURRENT
import { ValidateDisplayProfileExists } from '../../system/validators/display-profile-exists-constraint.validator';

@ValidateDisplayProfileExists({ message: '...' })
display?: string | null;

// TARGET
import { ValidateDisplayExists } from '../../displays/validators/display-exists-constraint.validator';

@ValidateDisplayExists({ message: '[{"field":"display","reason":"The specified display does not exist."}]' })
display?: string | null;
```

**`dto/update-page.dto.ts`**:
```typescript
// Same change as create-page.dto.ts
```

#### 8.4 Update Tests

Files to update:
- `services/pages.service.spec.ts`
- `services/tiles.service.spec.ts`
- `services/data-sources.service.spec.ts`
- `controllers/pages.controller.spec.ts`
- `controllers/tiles.controller.spec.ts`
- `controllers/data-source.controller.spec.ts`

Changes:
```typescript
// CURRENT
import { DisplayProfileEntity } from '../../system/entities/system.entity';
import { DisplaysProfilesService } from '../../system/services/displays-profiles.service';

const mockDisplay: DisplayProfileEntity = { ... };

// TARGET
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { DisplaysService } from '../../displays/services/displays.service';

const mockDisplay: DisplayEntity = {
  id: uuid().toString(),
  uid: uuid().toString(),
  mac: '00:1A:2B:3C:4D:5E',
  version: '1.0.0',
  build: '42',
  screenWidth: 1280,
  screenHeight: 720,
  pixelRatio: 1.0,
  unitSize: 8,
  rows: 12,
  cols: 24,
  primary: true,
  darkMode: false,
  brightness: 100,
  screenLockDuration: 30,
  screenSaver: true,
  lastSeenAt: new Date(),
  createdAt: new Date(),
  updatedAt: null,
};
```

#### 8.5 Update Module Imports (`dashboard.module.ts`)

```typescript
// CURRENT
import { SystemModule } from '../system/system.module';

@Module({
  imports: [
    // ...
    SystemModule,  // For DisplaysProfilesService
  ],
})

// TARGET
import { DisplaysModule } from '../displays/displays.module';

@Module({
  imports: [
    // ...
    DisplaysModule,  // For DisplaysService
  ],
})
```

---

## API Endpoints

### Displays Module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/displays-module/register` | Public (UA) | Register & get token |
| GET | `/displays-module/displays` | Owner/Admin | List all |
| GET | `/displays-module/displays/:id` | Any | Get by ID |
| GET | `/displays-module/displays/by-uid/:uid` | Any | Get by UID |
| PATCH | `/displays-module/displays/:id` | Display/Owner | Update |
| DELETE | `/displays-module/displays/:id` | Owner/Admin | Delete |

### Auth Module (Display Tokens)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth-module/tokens/displays` | Owner/Admin | List display tokens |
| DELETE | `/auth-module/tokens/displays/:id` | Owner/Admin | Revoke token |

### Removed Endpoints

- `POST /auth-module/auth/register-display`
- `* /users-module/displays-instances/*`
- `* /system-module/displays-profiles/*`
- `GET/PATCH /config-module/config/display`

---

## Database Migration

```typescript
export class ConsolidateDisplaysModule implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create new unified displays table
    await queryRunner.query(`
      CREATE TABLE "displays_module_displays" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "uid" uuid UNIQUE NOT NULL,
        "mac" varchar NOT NULL,
        "version" varchar NOT NULL,
        "build" varchar NOT NULL,
        "screenWidth" int,
        "screenHeight" int,
        "pixelRatio" float,
        "unitSize" float,
        "rows" int,
        "cols" int,
        "primary" boolean DEFAULT false,
        "darkMode" boolean DEFAULT false,
        "brightness" int DEFAULT 100,
        "screenLockDuration" int DEFAULT 30,
        "screenSaver" boolean DEFAULT true,
        "lastSeenAt" datetime,
        "createdAt" datetime DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" datetime
      )
    `);

    // 2. Migrate data from old tables to new unified table
    // Merge display profiles and instances by UID
    await queryRunner.query(`
      INSERT INTO "displays_module_displays" (
        "id", "uid", "mac", "version", "build",
        "screenWidth", "screenHeight", "pixelRatio", "unitSize",
        "rows", "cols", "primary", "createdAt"
      )
      SELECT 
        p.id, p.uid, 
        COALESCE(i.mac, '00:00:00:00:00:00'),
        COALESCE(i.version, '0.0.0'),
        COALESCE(i.build, '0'),
        p.screenWidth, p.screenHeight, p.pixelRatio, p.unitSize,
        p.rows, p.cols, p.primary, p.createdAt
      FROM "system_module_displays_profiles" p
      LEFT JOIN "users_module_displays_instances" i ON p.uid = i.uid
    `);

    // 3. Update dashboard_module_pages FK to reference new table
    // Note: The FK column name stays 'displayId', just points to new table
    // TypeORM will handle this through entity relation update

    // 4. Add columns to auth_module_tokens for flexible ownership
    await queryRunner.query(`
      ALTER TABLE "auth_module_tokens"
      ADD COLUMN "ownerType" varchar DEFAULT 'user'
    `);
    
    await queryRunner.query(`
      ALTER TABLE "auth_module_tokens"
      ADD COLUMN "ownerId" uuid
    `);

    // 5. Migrate existing long-live tokens (set ownerType for existing user tokens)
    await queryRunner.query(`
      UPDATE "auth_module_tokens"
      SET "ownerType" = 'user', "ownerId" = "ownerId"
      WHERE "type" = 'LongLiveTokenEntity'
    `);

    // 6. Update user role constraint (remove 'display')
    // SQLite approach: recreate table without 'display' in CHECK constraint
    // For production, this needs careful handling

    // 7. Drop old tables
    await queryRunner.query(`DROP TABLE IF EXISTS "users_module_displays_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_module_displays_profiles"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse migration - recreate old tables and migrate data back
    // ... implementation
  }
}
```

---

## Success Criteria

1. ✅ `DisplayEntity` standalone (no user relation)
2. ✅ `UserRole.DISPLAY` removed
3. ✅ `LongLiveTokenEntity` uses plain ID + owner type
4. ✅ `AccessToken`/`RefreshToken` keep direct user relation
5. ✅ Display registration returns long-lived token
6. ✅ Admins can list/revoke display tokens
7. ✅ Display settings in entity
8. ✅ WebSocket auth works for displays
9. ✅ All tests passing

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Auth Module Updates | 3-4 hours |
| Users Module Cleanup | 2-3 hours |
| System Module Cleanup | 1-2 hours |
| Config Module Updates | 1 hour |
| Displays Module | 4-5 hours |
| Token Management | 2 hours |
| WebSocket Updates | 2 hours |
| Dashboard Updates | 2-3 hours |
| Database Migration | 2-3 hours |
| Testing | 4-5 hours |
| **Total** | **23-31 hours** |

---

## Files Changed Summary

### New Files (Displays Module)

```
apps/backend/src/modules/displays/
├── controllers/
│   ├── displays.controller.ts
│   ├── displays.controller.spec.ts
│   ├── registration.controller.ts
│   └── registration.controller.spec.ts
├── dto/
│   ├── register-display.dto.ts
│   └── update-display.dto.ts
├── entities/
│   └── displays.entity.ts
├── models/
│   └── displays-response.model.ts
├── services/
│   ├── displays.service.ts
│   ├── displays.service.spec.ts
│   ├── registration.service.ts
│   ├── registration.service.spec.ts
│   └── module-reset.service.ts
├── validators/
│   └── display-exists-constraint.validator.ts
├── displays.constants.ts
├── displays.exceptions.ts
├── displays.module.ts
└── displays.openapi.ts
```

### Modified Files

**Auth Module:**
- `auth/auth.constants.ts` - Add `TokenOwnerType` enum
- `auth/entities/auth.entity.ts` - Update `LongLiveTokenEntity`
- `auth/dto/create-token.dto.ts` - Add `ownerType`, `ownerId`
- `auth/dto/update-token.dto.ts` - Add `ownerType`, `ownerId`
- `auth/services/tokens.service.ts` - Add owner type queries
- `auth/guards/auth.guard.ts` - Support display token validation
- `auth/controllers/auth.controller.ts` - Remove `registerDisplay`
- `auth/controllers/tokens.controller.ts` - Add display token management

**Users Module:**
- `users/users.constants.ts` - Remove `UserRole.DISPLAY`
- `users/entities/users.entity.ts` - Remove `DisplayInstanceEntity`
- `users/users.module.ts` - Remove display-related providers
- `users/users.openapi.ts` - Remove display models
- `users/models/users-response.model.ts` - Remove display response models
- `users/services/module-reset.service.ts` - Remove display reset

**System Module:**
- `system/entities/system.entity.ts` - Remove `DisplayProfileEntity`
- `system/system.module.ts` - Remove display-related providers
- `system/system.constants.ts` - Remove display events
- `system/system.openapi.ts` - Remove display models
- `system/models/system-response.model.ts` - Remove display response models
- `system/services/module-reset.service.ts` - Remove display reset

**Config Module:**
- `config/config.constants.ts` - Remove `SectionType.DISPLAY`
- `config/models/config.model.ts` - Remove `DisplayConfigModel`
- `config/dto/config.dto.ts` - Remove display DTO
- `config/services/config.service.ts` - Remove display config handling

**Dashboard Module:**
- `dashboard/entities/dashboard.entity.ts` - Update display relation
- `dashboard/services/pages.service.ts` - Update imports
- `dashboard/dto/create-page.dto.ts` - Update validator import
- `dashboard/dto/update-page.dto.ts` - Update validator import
- `dashboard/dashboard.module.ts` - Update imports
- `dashboard/services/pages.service.spec.ts` - Update tests
- `dashboard/services/tiles.service.spec.ts` - Update tests
- `dashboard/services/data-sources.service.spec.ts` - Update tests
- `dashboard/controllers/pages.controller.spec.ts` - Update tests
- `dashboard/controllers/tiles.controller.spec.ts` - Update tests
- `dashboard/controllers/data-source.controller.spec.ts` - Update tests

**WebSocket Module:**
- `websocket/services/ws-auth.service.ts` - Support display auth
- `websocket/gateway/websocket.gateway.ts` - Handle display connections
- `websocket/dto/client-user.dto.ts` - Update for auth types

**Devices Module:**
- `devices/services/property-command.service.ts` - Update auth check

**App Module:**
- `app.module.ts` - Add DisplaysModule import

### Deleted Files

**Users Module:**
- `users/controllers/displays-instances.controller.ts`
- `users/controllers/displays-instances.controller.spec.ts`
- `users/services/displays-instances.service.ts`
- `users/services/displays-instances.service.spec.ts`
- `users/dto/create-display-instance.dto.ts`
- `users/dto/update-display-instance.dto.ts`
- `users/subscribers/system-display-entity.subscriber.ts`

**System Module:**
- `system/controllers/displays-profiles.controller.ts`
- `system/controllers/displays-profiles.controller.spec.ts`
- `system/services/displays-profiles.service.ts`
- `system/services/displays-profiles.service.spec.ts`
- `system/dto/create-display-profile.dto.ts`
- `system/dto/update-display-profile.dto.ts`
- `system/validators/display-profile-exists-constraint.validator.ts`

**Auth Module:**
- `auth/dto/register-display.dto.ts`
