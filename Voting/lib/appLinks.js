/**
 * Shareable vote links: HTTPS landing page + custom-scheme deep link into the Android app.
 */

export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

/** Custom scheme opened by the installed Android app. */
export function getVoteDeepLink(electionId) {
  return `blockvote://vote/${encodeURIComponent(String(electionId))}`;
}

/**
 * HTTPS link for email / clipboard. Opens /go/[electionId] which
 * redirects into the app (or shows install instructions).
 */
export function getVoteInviteUrl(electionId) {
  return `${getAppBaseUrl()}/go/${encodeURIComponent(String(electionId))}`;
}
