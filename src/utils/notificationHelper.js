const webpush = require('../config/webpush');
const PushSubscription = require('../models/PushSubscription');

/**
 * @desc Send push notification to all subscriptions of a specific user
 */
const sendPushNotification = async (userId, payload) => {
  if (!webpush) return;
  try {
    const subscriptions = await PushSubscription.find({ userId });
    
    const notifications = subscriptions.map(async (sub) => {
      try {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        };
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        // Agar subscription expire (410) ya invalid (404) ho jaye to delete kar dein
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.findByIdAndDelete(sub._id);
        }
        console.error(`Push error for user ${userId}:`, err.message);
      }
    });

    await Promise.allSettled(notifications);
  } catch (error) {
    console.error('sendPushNotification error:', error);
  }
};

module.exports = { sendPushNotification };