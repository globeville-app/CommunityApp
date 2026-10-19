"""
Badge rules you can tune, in one place (docs/BADGES.md is the source of
truth; docs/MILESTONE_3.md says how they're built). The app reads these
through GET /api/badges/catalog, so they're never copied into the app.

Changing a threshold never lowers a stage someone already reached: stages
are stored as "highest reached" (BadgeState.stage).
"""

# Counts needed for Seed, Sprout, Bloom, Tree and Grove, per track.
TRACK_THRESHOLDS = {
    "everyday": [1, 3, 9, 24, 60],  # events attended
    "occasional": [1, 2, 5, 10, 18],  # events of one type, attended or hosted
    "variety": [2, 4, 8, 15, 30],  # different hosts
    "host_reach": [2, 10, 30, 80, 200],  # neighbors brought together
}

STAGES = ["seed", "sprout", "bloom", "tree", "grove"]  # stage 1..5

# After Grove, celebrate again at these multiples of the Grove number.
GROVE_MILESTONE_MULTIPLIERS = [2, 3]

# The 11 growth badges: (key, track, what grows it). "group:x" means the
# event category group x; "category:x" one category; the rest are special.
GROWTH_BADGES = [
    ("local", "everyday", "any"),
    ("best_guest", "variety", "distinct_hosts"),
    ("host", "host_reach", "neighbors_brought_together"),
    ("day_one", "occasional", "hosts_first_event"),
    ("fiestero", "occasional", "group:celebrate"),
    ("treasure_hunter", "occasional", "group:buy_swap"),
    ("aficionado", "occasional", "group:entertainment"),
    ("recreationist", "occasional", "group:get_active"),
    ("helping_hand", "occasional", "group:community"),
    ("clean_sweeper", "occasional", "category:cleanup"),
    ("civic_voice", "occasional", "category:community_meeting"),
]

# The 4 keepsakes, earned once.
KEEPSAKES = ["ambassador", "open_door", "familiar_face", "year_rounder"]

# Attending these never counts toward any badge or hint, because attending
# can mean someone needed help. Hosting them does count.
SENSITIVE_CATEGORIES = {"resource_fair", "donation_drive"}

# Attendance
COLLECT_WINDOW_DAYS = 7  # a collect card stays this long after the event ends
CHECKIN_EARLY_MINUTES = 30  # auto check-in opens this long before the start
GEOFENCE_RADIUS_METERS = 150
MAX_GEOFENCES = 20  # iPhones watch at most 20 places per app
HOSTED_MIN_ATTENDEES = 2  # a hosted event counts once 2 neighbors went
REOFFER_AFTER_EXPIRED = 3  # re-offer auto check-in after 3 missed collects

# Community badges (admin only), over the last 12 months.
COMMUNITY_GROUP_MIN_EVENTS = 6
COMMUNITY_GROUP_MIN_NEIGHBORS = 20
COMMUNITY_SIGNATURES = {"cleanup": "Known for cleanups", "community_meeting": "Known for showing up"}
COMMUNITY_SIGNATURE_MIN_EVENTS = 4
COMMUNITY_SIGNATURE_MIN_NEIGHBORS = 15

GROWTH_KEYS = [key for key, _, _ in GROWTH_BADGES]
ALL_BADGE_KEYS = GROWTH_KEYS + KEEPSAKES
TRACK_OF = {key: track for key, track, _ in GROWTH_BADGES}


def thresholds(badge_key):
    return TRACK_THRESHOLDS[TRACK_OF[badge_key]]


def stage_for(badge_key, count):
    """How many thresholds the count has reached: 0 (not yet) to 5 (Grove)."""
    return sum(1 for needed in thresholds(badge_key) if count >= needed)


def next_threshold(badge_key, stage):
    """The count for the next stage, or None after Grove."""
    levels = thresholds(badge_key)
    return levels[stage] if stage < len(levels) else None

# Milestone 4: organizations earn only the hosting side (docs/MILESTONE_4.md):
# Host, the group and signature badges, and the Open Door keepsake.
ORG_GROWTH_KEYS = [key for key, _, rule in GROWTH_BADGES if rule == "neighbors_brought_together" or ":" in rule]
ORG_KEEPSAKES = ["open_door"]
