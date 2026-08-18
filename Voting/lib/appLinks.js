/**
 * Shareable vote links: HTTPS landing page, web beta portal, and Android deep links.
 */

export const ANDROID_PACKAGE = 'com.blockvote.android';

export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function encodePathSegment(value) {
  return encodeURIComponent(String(value ?? ''));
}

function getCanonicalOrgElectionBaseUrl({ orgName, electionName, electionId }) {
  if (!orgName || !electionName || !electionId) {
    throw new Error(
      'Missing orgName, electionName, or electionId for canonical vote URL generation.',
    );
  }

  return (
    `${getAppBaseUrl()}/org/${encodePathSegment(orgName)}` +
    `/election/${encodePathSegment(electionName)}` +
    `/${encodePathSegment(electionId)}`
  );
}

/** Custom scheme opened by the installed Android app. */
export function getVoteDeepLink(electionId) {
  if (!electionId) return 'blockvote://vote/';
  return `blockvote://vote/${encodeURIComponent(String(electionId))}`;
}

/**
 * Canonical HTTPS link for both:
 * - Android app opening (via MobileAppGate redirect logic)
 * - Web beta voting (use ?web=1 query)
 */
export function getVoteInviteUrl(electionId, { orgName, electionTitle } = {}) {
  // Backward compatibility note: old code paths that only passed electionId
  // will now throw, because you requested no random/legacy links.
  return getCanonicalOrgElectionBaseUrl({
    orgName,
    electionName: electionTitle,
    electionId,
  });
}

/** Desktop web beta ballot — no surrounding / motion monitoring. */
export function getWebPortalUrl(electionId, { orgName, electionTitle } = {}) {
  const base = getVoteInviteUrl(electionId, { orgName, electionTitle });
  return `${base}?web=1`;
}

/**
 * Chrome/Android intent URL. Opens the app if installed; otherwise the
 * browser stays on the current page (fallback UI handles install).
 */
export function getAndroidIntentUrl(electionId) {
  const path = electionId ? encodeURIComponent(String(electionId)) : '';
  return `intent://vote/${path}#Intent;scheme=blockvote;package=${ANDROID_PACKAGE};end`;
}
