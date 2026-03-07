

## Diagnosis: Why fleet shows on desktop but not mobile

The `/flota` page queries the `vehicles` table filtering by `status = 'available'`. This query returns **zero results** because there are no individual vehicles with that status in the database. This is the same on both desktop and mobile -- the page shows "No hay vehiculos disponibles" on both.

The homepage "Flota" section (`FeaturedVehicles`) works because it queries `vehicle_categories` (which has 3 active categories) and also has hardcoded fallback data. This is what you see working.

## Plan: Fix /flota to show categories instead of individual vehicles

Since the database has **vehicle categories** with data but no individual vehicles marked as available, the `/flota` page should display categories (like the homepage does) instead of querying individual vehicles.

### Changes to `src/pages/Fleet.tsx`:

1. **Replace the Supabase query** -- query `vehicle_categories` (with translations) instead of `vehicles`, matching the pattern used by `FeaturedVehicles.tsx`
2. **Use the `CategoryCard` component** that already exists at `src/components/fleet/CategoryCard.tsx` for rendering each category
3. **Use `getVehicleTranslation`** for i18n support (already used in CategoryCard)
4. **Keep the grid responsive** -- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` so it works on all screen sizes
5. **Remove the 2-per-category limit logic** since we're showing categories directly

This aligns `/flota` with the data model that actually has content and ensures it works on all devices.

