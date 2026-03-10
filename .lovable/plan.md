

## Fix: Conoce Gran Canaria admin module

### Problem
`/admin/conoce-gran-canaria` has no route in `App.tsx`, so it falls through to `/:lang/*` (with `lang="admin"`) and renders the public DiscoverGC page.

### Changes

**1. Create `src/pages/admin/TouristPlaces.tsx`** (~500 lines)

Full CRUD following existing patterns (Branches.tsx, ContentManagement.tsx):

- **Listing:** Query `tourist_places` with inner select of `tourist_place_translations` filtered to `lang=es` and `tourist_place_photos`. Table columns: cover photo thumbnail, name (es), slug, featured badge, sort_order, active badge, edit/delete buttons. Filters for active/inactive and featured/not.
- **Delete:** Confirmation dialog. Deletes `tourist_place_photos` → `tourist_place_translations` → `tourist_places` (in order). Audit log.
- **Create/Edit modal** with two tabs (Radix Tabs):
  - **Tab 1 - General:** slug (validated: lowercase, no spaces), google_maps_url, is_featured toggle, is_active toggle, sort_order input, photo upload (up to 3 images to `tourist-places` bucket via `supabase.storage`, stored in `tourist_place_photos` with field_name photo_1/photo_2/photo_3).
  - **Tab 2 - Translations:** Section per language (es/en/de/sv/no/fr) with name, short_description (textarea), long_description (textarea). Saves to `tourist_place_translations` with upsert logic (insert or update by place_id + lang).
- All operations logged to `audit_log` via `writeAudit`.

**2. Edit `src/App.tsx`**
- Import `TouristPlaces` from `./pages/admin/TouristPlaces`
- Add route: `<Route path="/admin/conoce-gran-canaria" element={<TouristPlaces />} />` inside the AdminLayout routes

No other files modified.

