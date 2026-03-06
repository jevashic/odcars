/**
 * Resolves the best available image for a vehicle.
 * Priority: 1) vehicle.images[0]  2) category image_url  3) null
 */
export function getVehicleImage(
  vehicleImages: any[] | null | undefined,
  categoryImageUrl: string | null | undefined,
): string | null {
  if (Array.isArray(vehicleImages) && vehicleImages.length > 0 && vehicleImages[0]) {
    return vehicleImages[0];
  }
  return categoryImageUrl ?? null;
}
