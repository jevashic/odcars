/**
 * Extracts the translated fields from a vehicle category that has
 * vehicle_category_translations joined.
 * Falls back to the original category values (Spanish) when no translation exists.
 */
export function getVehicleTranslation(
  cat: any,
  lang: string,
): { name: string; transmission_note: string; energy_type: string; description?: string } {
  const translations: any[] = cat.vehicle_category_translations ?? [];
  const tr = translations.find((t: any) => t.lang === lang) ?? translations[0];
  return {
    name: tr?.name ?? cat.name,
    transmission_note: tr?.transmission_note ?? cat.transmission_note,
    energy_type: tr?.energy_type ?? cat.energy_type,
    description: tr?.description ?? cat.description,
  };
}
