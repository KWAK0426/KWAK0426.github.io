// MicaSense RedEdge-MX Dual center wavelengths, in exported wavelength order.
// https://support.micasense.com/hc/en-us/articles/214878778
const names = new Map([
  [444, 'Coastal Blue'], [475, 'Blue'], [531, 'Green'], [560, 'Green'],
  [650, 'Red'], [668, 'Red'], [705, 'Red Edge'], [717, 'Red Edge'],
  [740, 'Red Edge'], [842, 'Near Infrared'],
]);
export const bandName = nm => names.get(Number(nm)) ?? '대역명 미확인';
export const bandLabel = nm => `${bandName(nm)} · ${nm} nm`;
