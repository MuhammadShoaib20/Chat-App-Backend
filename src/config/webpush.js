const webpush = require('web-push');

const hasVapid =
  process.env.VAPID_SUBJECT &&
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY;

if (hasVapid) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID keys not set – push notifications disabled. Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY to enable.');
}

module.exports = hasVapid ? webpush : null;
