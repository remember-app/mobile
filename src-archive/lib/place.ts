import type { LocationGeocodedAddress } from 'expo-location';
export type Placemark = Partial<
  Pick<
    LocationGeocodedAddress,
    'name' | 'street' | 'streetNumber' | 'city' | 'subregion' | 'region' | 'country'
  >
>;
const said = (part: string | null | undefined) => part?.trim() ?? '';
function nameOf(at: Placemark): string | null {
  const street = said(at.street);
  const name = said(at.name);
  const named = /\p{L}{2,}/u.test(name) && name !== street && !(street && name.includes(street));
  const address = street && `${street} ${said(at.streetNumber)}`.trim();
  const area = said(at.city) || said(at.subregion) || said(at.region);
  const parts = [named ? name : address, area].filter(
    (part, i, all) => part && all.indexOf(part) === i,
  );
  return parts.join(', ') || said(at.country) || null;
}
export function placeName(answer: readonly Placemark[]): string | null {
  return answer.map(nameOf).find(Boolean) ?? null;
}
