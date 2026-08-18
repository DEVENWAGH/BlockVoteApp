/** Browser UA helpers for the voter web portal. Safe to import from client components. */

export function isAndroidUserAgent(ua = '') {
  return /android/i.test(ua);
}

export function isIosUserAgent(ua = '') {
  return /iphone|ipad|ipod/i.test(ua);
}

export function isMobileUserAgent(ua = '') {
  return (
    isAndroidUserAgent(ua) ||
    isIosUserAgent(ua) ||
    /webos|blackberry|iemobile|opera mini/i.test(ua)
  );
}
