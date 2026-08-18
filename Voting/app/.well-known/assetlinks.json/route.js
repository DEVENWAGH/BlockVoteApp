import { NextResponse } from 'next/server';

/**
 * Digital Asset Links for Android App Links on https://www.devz.co.in
 * Debug keystore SHA-256 is included for local sideloads. Replace/add the
 * Play App Signing cert fingerprint before production App Link verification.
 */
const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.blockvote.android',
      sha256_cert_fingerprints: [
        'E4:E4:C0:51:BE:66:ED:95:0B:B2:63:6C:12:CA:F1:CF:9D:51:24:24:DA:E9:F7:78:7E:86:53:78:60:39:FE:C8',
      ],
    },
  },
];

export function GET() {
  return NextResponse.json(ASSET_LINKS, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
