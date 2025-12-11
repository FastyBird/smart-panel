# Page-Display Relation Refactoring Plan

## Overview
Change the page-display relationship from 1:1 (ManyToOne) to 1:n (ManyToMany), allowing pages to be assigned to multiple displays or no displays (meaning visible to all).

## Implementation Steps

### Phase 1: Backend - Database Schema & Entity Changes

#### 1.1 Update PageEntity (dashboard.entity.ts)
- [x] Change `display` field from `ManyToOne` to `ManyToMany`
- [x] Create join table `dashboard_module_pages_displays` (or use TypeORM's auto-generated name)
- [x] Update decorators: `@ManyToMany(() => DisplayEntity, { nullable: true })` with `@JoinTable`
- [x] Change type from `DisplayEntity | string | null` to `DisplayEntity[]`
- [x] Update `@Transform` decorator to handle array of display IDs
- [x] Update `@ApiProperty` to reflect array type
- [x] Update validation decorators to accept array of UUIDs

#### 1.2 Create Database Migration
- [x] Create migration to:
  - Drop existing `displayId` column from `dashboard_module_pages`
  - Create join table `dashboard_module_pages_displays` with columns:
    - `pageId` (FK to dashboard_module_pages.id)
    - `displayId` (FK to displays_module_displays.id)
  - Migrate existing data: for each page with displayId, create join table entry
  - Add indexes for performance

#### 1.3 Update CreatePageDto (create-page.dto.ts)
- [x] Change `display` from `string | null` to `string[] | null`
- [x] Update validation: `@IsArray()`, `@IsUUID('4', { each: true })`
- [x] Update `@ValidateDisplayExists` to work with array (or create new validator)
- [x] Update `@ApiProperty` to show array type

#### 1.4 Update UpdatePageDto (update-page.dto.ts)
- [x] Change `display` from `string | null` to `string[] | null`
- [x] Update validation: `@IsArray()`, `@IsUUID('4', { each: true })`
- [x] Update `@ValidateDisplayExists` to work with array
- [x] Update `@ApiProperty` to show array type

#### 1.5 Update PagesService (pages.service.ts)
- [x] Update `findAll()`: Change `relations: ['display']` to `relations: ['displays']`
- [x] Update `findOne()`: Change `leftJoinAndSelect('page.display', 'display')` to `leftJoinAndSelect('page.displays', 'displays')`
- [x] Update `create()` method:
  - Remove `findPrimary()` logic (lines 126-134)
  - Handle array of display IDs: validate all exist, set empty array if null/undefined
  - Set `page.displays = []` if no displays provided (meaning visible to all)
- [x] Update `update()` method:
  - Remove display validation that checks single display
  - Handle array of display IDs: validate all exist
  - If `display` is provided in DTO, replace all existing relations
  - If `display` is null/undefined, keep existing relations
- [x] Update `remove()`: No changes needed (cascade handles join table)
- [x] Update `getOneOrThrow()`: Load `displays` relation instead of `display`

#### 1.6 Remove Primary Display Logic
- [x] Remove `findPrimary()` method from PagesService
- [x] Remove any references to "primary" display concept
- [x] Remove `primary` field from DisplayEntity (if exists)
- [x] Update any queries that filter by primary display

#### 1.7 Update Validators
- [x] Update `@ValidateDisplayExists` decorator to handle array of display IDs
- [x] Or create new `@ValidateDisplaysExist` decorator
- [x] Update validation error messages

#### 1.8 Update Tests
- [x] Update unit tests for PagesService
- [x] Update unit tests for PagesController
- [x] Update e2e tests for page creation/update
- [x] Test multiple displays assignment
- [x] Test empty array (visible to all)
- [x] Test null handling

### Phase 2: Backend - API Response Models

#### 2.1 Update Response Models
- [x] Update `PageResponseModel` to include `displays` array
- [x] Update `PagesResponseModel` to include `displays` array in each page
- [x] Update OpenAPI schema generation
- [x] Ensure backward compatibility in API responses

### Phase 3: Admin App - Store & Types

#### 3.1 Update Store Schemas (pages.store.schemas.ts)
- [x] Update `createPageSchema` to accept `displays` as array
- [x] Update `updatePageSchema` to accept `displays` as array
- [x] Update validation rules for array of UUIDs

#### 3.2 Update Store Types (pages.store.types.ts)
- [x] Change `display` field type from `string | null` to `string[] | null`
- [x] Update TypeScript interfaces
- [x] Update type guards if needed

#### 3.3 Update Store Transformers (pages.transformers.ts)
- [x] Update `toCreatePageDto()` to handle array
- [x] Update `toUpdatePageDto()` to handle array
- [x] Update `fromPageEntity()` to extract array from entity

#### 3.4 Update Store Service (pages.store.ts)
- [x] Update `create()` action to handle array of display IDs
- [x] Update `update()` action to handle array of display IDs
- [x] Update `fetchOne()` to load displays relation
- [x] Update `fetchAll()` to load displays relation

### Phase 4: Admin App - Forms & UI

#### 4.1 Update Create Page Form
- [x] Change display selector from single select to multi-select
- [x] Update form validation
- [x] Update form submission handler
- [x] Add "Visible to all displays" option (empty array)

#### 4.2 Update Edit Page Form
- [x] Change display selector from single select to multi-select
- [x] Pre-populate with existing display assignments
- [x] Update form validation
- [x] Update form submission handler

#### 4.3 Update Page List View
- [x] Update display column to show multiple displays
- [x] Show "All displays" if array is empty
- [x] Update display formatting (tags, badges, etc.)

#### 4.4 Update Page Detail View
- [x] Update display section to show array
- [x] Update display formatting

### Phase 5: Panel App

#### 5.1 Update Page Loading Logic
- [x] Update page fetching to filter by current display ID
- [x] Include pages with empty displays array (visible to all)
- [x] Update socket event handlers for page updates
- [x] Handle display assignment changes in real-time

#### 5.2 Update Page Model
- [x] Change `display` field from single ID to array of IDs
- [x] Update model parsing from API responses
- [x] Update model serialization if needed

### Phase 6: Testing

#### 6.1 Backend Tests
- [x] Unit tests for PagesService with multiple displays
- [x] Unit tests for PagesController with multiple displays
- [x] E2E tests for page creation with multiple displays
- [x] E2E tests for page update with multiple displays
- [x] E2E tests for page with no displays (visible to all)
- [x] E2E tests for display deletion cleanup

#### 6.2 Admin App Tests
- [x] Unit tests for store with multiple displays
- [x] Component tests for multi-select display picker
- [x] E2E tests for page creation/editing

#### 6.3 Panel App Tests
- [x] Unit tests for page filtering logic
- [x] Integration tests for page loading
- [x] E2E tests for page visibility

## Migration Strategy

### Database Migration
1. Create join table `dashboard_module_pages_displays`
2. Migrate existing data: for each page with `displayId`, create join table entry
3. Drop `displayId` column from `dashboard_module_pages`
4. Add indexes for performance

### Backward Compatibility
- API responses maintain same structure (just array instead of single value)
- Admin UI gracefully handles transition
- Panel app handles both old and new formats during transition

## Rollback Plan

If issues arise:
1. Revert database migration
2. Restore `displayId` column
3. Migrate data back from join table
4. Revert code changes

## Testing Checklist

- [x] Create page with multiple displays
- [x] Create page with no displays (visible to all)
- [x] Update page to add/remove displays
- [x] Delete display and verify page relations cleaned up
- [x] Panel app loads pages correctly for current display
- [x] Panel app loads pages with no display assignment (visible to all)
- [x] Socket updates work correctly
- [x] All existing tests pass

## Status: ✅ Completed

All phases have been implemented and tested. The page-display relationship is now 1:n (ManyToMany), allowing pages to be assigned to multiple displays or no displays (visible to all).
