/**
 * Shareable vote links: HTTPS invite page and Android deep links.
 * Web ballots exist only on activated polling-station computers (/station).
 */
import { getPublicBaseUrl } from './serverEnv.js';

export const ANDROID_PACKAGE = 'com.blockvote.android';

export function getAppBaseUrl() {
  return getPublicBaseUrl();
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

/** Canonical HTTPS invite link; the page opens the Android app (MobileAppGate). */
export function getVoteInviteUrl(electionId, { orgName, electionTitle } = {}) {
  return getCanonicalOrgElectionBaseUrl({
    orgName,
    electionName: electionTitle,
    electionId,
  });
}

/**
 * Chrome/Android intent URL. Opens the app if installed; otherwise the
 * browser stays on the current page (fallback UI handles install).
 */
export function getAndroidIntentUrl(electionId) {
  const path = electionId ? encodeURIComponent(String(electionId)) : '';
  return `intent://vote/${path}#Intent;scheme=blockvote;package=${ANDROID_PACKAGE};end`;
}
