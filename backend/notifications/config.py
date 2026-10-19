"""
Push notification settings you can tune (docs/MILESTONE_4.md).
"""

# Reminders go out at this hour (America/Denver) on the day before the event.
REMINDER_HOUR = 17  # 5:00 PM

# Expo's push service. The phone app registers with Expo and gives us a token.
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Expo accepts up to 100 messages per request.
EXPO_BATCH_SIZE = 100
EXPO_TIMEOUT_SECONDS = 15
