import type { LocationGeocodedAddress } from 'expo-location';

/**
 * A place as one line of words — «Усадьба «Остафьево», Москва», «Тверская улица 13, Москва» — out of
 * what the phone's own geocoder answers about a point (`reverseGeocodeAsync`). Kept apart from the
 * module that asks the phone (`@/geocoder`) so that a test reads it with no phone at all.
 *
 * Every field is optional in what it is handed: the two platforms fill different ones, and a point
 * in a field or a sea has a region and nothing else.
 */
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
  // The placemark's name is the place's own — a manor, a bridge — only when it is not the address
  // said over again, which a geocoder may well put there: the house number on its own, or the street
  // with its number. A number does not name anything, so a name needs two letters in a row.
  const named = /\p{L}{2,}/u.test(name) && name !== street && !(street && name.includes(street));
  // A number with no street under it is not an address either.
  const address = street && `${street} ${said(at.streetNumber)}`.trim();
  const area = said(at.city) || said(at.subregion) || said(at.region);
  const parts = [named ? name : address, area].filter(
    (part, i, all) => part && all.indexOf(part) === i,
  );
  return parts.join(', ') || said(at.country) || null;
}

/**
 * The line to write under «Место», or `null` when the geocoder said nothing worth writing (an empty
 * answer, or one with nothing but blanks). What stands first is the most particular thing it knew —
 * the place's own name, else the street and house — and the city (else the district, else the
 * region) after it; the country is the last resort and never rides along.
 *
 * The language is the phone's, not the app's: the geocoder has no way to be asked for another one.
 */
export function placeName(answer: readonly Placemark[]): string | null {
  return answer.map(nameOf).find(Boolean) ?? null;
}
