/**
 * Coarse location helpers — village/city/state only, never store coordinates.
 */

function pickText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function inferLocalityType(address = {}) {
  if (address.city || address.town) return 'urban';
  if (address.village || address.hamlet || address.suburb) return 'rural';
  return '';
}

export function normalizeCoarseLocation(input = {}) {
  const village = pickText(input.village, input.hamlet, input.suburb, input.neighbourhood);
  const city = pickText(input.city, input.town, input.municipality, input.county);
  const state = pickText(input.state, input.region);
  const region = pickText(input.region, input.state);
  const localityType = pickText(input.localityType, inferLocalityType(input));

  if (!village && !city && !state && !region) return null;

  return {
    village,
    city,
    state,
    region,
    localityType,
  };
}

export async function reverseGeocode(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid coordinates');
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('zoom', '14');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BlockVote/1.0 (election analytics; coarse location only)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Reverse geocoding failed');
  }

  const payload = await response.json();
  const address = payload.address || {};

  return normalizeCoarseLocation({
    village: address.village || address.hamlet || address.suburb || address.neighbourhood,
    city: address.city || address.town || address.municipality,
    state: address.state,
    region: address.state || address.region,
    localityType: inferLocalityType(address),
  });
}

export async function applyCoarseLocationToVoter(voterId, location) {
  if (!voterId || !location) return;

  const normalized = normalizeCoarseLocation(location);
  if (!normalized) return;

  const Voter = (await import('./models/Voter.js')).default;
  const update = {
    locationCapturedAt: new Date(),
  };

  if (normalized.village) update.village = normalized.village;
  if (normalized.city) update.city = normalized.city;
  if (normalized.state) update.state = normalized.state;
  if (normalized.region) update.region = normalized.region;
  if (normalized.localityType) update.localityType = normalized.localityType;

  await Voter.findByIdAndUpdate(voterId, { $set: update });
}
