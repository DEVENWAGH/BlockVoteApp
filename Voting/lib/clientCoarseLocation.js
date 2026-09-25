/**
 * Browser helper: request coarse location and return village/city/state labels only.
 */

export async function requestCoarseLocation() {
  if (typeof window === 'undefined' || !navigator?.geolocation) {
    return null;
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 5 * 60 * 1000,
    });
  });

  const { latitude, longitude } = position.coords;
  const response = await fetch('/api/location/reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: latitude, lng: longitude }),
  });

  const data = await response.json();
  if (!response.ok || !data.location) {
    throw new Error(data.error || 'Could not resolve coarse location');
  }

  return data.location;
}
