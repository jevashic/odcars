/**
 * Resolves the best available image for a vehicle.
 * Priority: 1) vehicle.images[0]  2) category image_url  3) null
 *
 * Handles multiple JSONB shapes:
 * - string[]  → ["https://…", "https://…"]
 * - {url}[]   → [{url: "https://…"}]
 * - string    → "https://…"
 */
export function getVehicleImage(
  vehicleImages: unknown,
  categoryImageUrl: string | null | undefined,
): string | null {
  if (vehicleImages) {
    // If it's an array with items
    if (Array.isArray(vehicleImages) && vehicleImages.length > 0) {
      const first = vehicleImages[0];
      if (typeof first === 'string' && first) return first;
      if (first && typeof first === 'object' && 'url' in first && typeof first.url === 'string') return first.url;
    }
    // If it's a single string
    if (typeof vehicleImages === 'string' && vehicleImages) return vehicleImages;
  }
  return categoryImageUrl ?? null;
}
