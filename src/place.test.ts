import { expect, test } from 'vitest';

import { placeName } from '@/place';

/**
 * The line under «Место» out of what the phone's geocoder answers (`reverseGeocodeAsync`). The two
 * platforms fill different fields and the same field differently, and none of this was read off a
 * real phone: these are the shapes the field docs allow, each with what it is written as.
 */

test('a place with a name of its own is written by that name, and the city after it', () => {
  // The manor of the layout (`SheetFrameInfo`): a point of interest, with the street beside it.
  expect(
    placeName([
      {
        name: 'Усадьба «Остафьево»',
        street: 'Остафьевская улица',
        streetNumber: '1',
        city: 'Москва',
        region: 'Москва',
        country: 'Россия',
      },
    ]),
  ).toBe('Усадьба «Остафьево», Москва');
});

test('an address is the street and the house, then the city', () => {
  // The address said again in `name`, in the street's own words.
  expect(
    placeName([
      { name: 'Тверская улица, 13', street: 'Тверская улица', streetNumber: '13', city: 'Москва' },
    ]),
  ).toBe('Тверская улица 13, Москва');
  // Or the house number alone in `name`: a number names nothing.
  expect(
    placeName([{ name: '13', street: 'Тверская улица', streetNumber: '13', city: 'Москва' }]),
  ).toBe('Тверская улица 13, Москва');
  expect(placeName([{ name: '13А', street: 'Тверская улица', city: 'Москва' }])).toBe(
    'Тверская улица, Москва',
  );
  // A house with no number, and a number with no street.
  expect(placeName([{ street: 'Тверская улица', city: 'Москва' }])).toBe('Тверская улица, Москва');
  expect(placeName([{ streetNumber: '13', city: 'Москва' }])).toBe('Москва');
});

test('with no street and no name it is the city, then the district, then the region', () => {
  expect(placeName([{ city: 'Москва', subregion: 'Подольский район', region: 'Москва' }])).toBe(
    'Москва',
  );
  expect(placeName([{ subregion: 'Подольский район', region: 'Московская область' }])).toBe(
    'Подольский район',
  );
  expect(placeName([{ region: 'Московская область', country: 'Россия' }])).toBe(
    'Московская область',
  );
  // A sea has a name and nothing around it.
  expect(placeName([{ name: 'Чёрное море' }])).toBe('Чёрное море');
});

test('the country is the last resort, and a name that is just the city is not said twice', () => {
  expect(placeName([{ country: 'Россия' }])).toBe('Россия');
  expect(placeName([{ name: 'Москва', city: 'Москва', country: 'Россия' }])).toBe('Москва');
});

test('a geocoder with nothing to say gives no name at all, never an empty string', () => {
  expect(placeName([])).toBeNull();
  expect(placeName([{}])).toBeNull();
  expect(
    placeName([{ name: null, street: null, streetNumber: null, city: null, region: null }]),
  ).toBeNull();
  // Blanks are nothing, and a house number alone is not a place.
  expect(placeName([{ name: '  ', street: ' ', city: '', region: ' ' }])).toBeNull();
  expect(placeName([{ name: '13', streetNumber: '13' }])).toBeNull();
});

test('the first answer that says anything is the one, and the pieces are trimmed', () => {
  expect(placeName([{}, { city: ' Казань ' }, { city: 'Москва' }])).toBe('Казань');
});
