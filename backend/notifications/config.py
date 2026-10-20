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

# A while after sending, Expo says whether each message really reached Apple
# or Google ("receipts"). We ask after this long, and Expo keeps them a day.
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"
RECEIPT_WAIT_MINUTES = 15
RECEIPT_KEEP_HOURS = 24
# Expo accepts up to 1,000 receipt ids per request.
EXPO_RECEIPT_BATCH_SIZE = 1000
