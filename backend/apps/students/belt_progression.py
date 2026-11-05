# Belt levels in progression order (index represents progression level)
BELT_LEVELS = [
    "White Belt",
    "Yellow Belt",
    "Orange Belt",
    "Green Belt",
    "Purple Belt",
    "1st Class Purple Belt",
    "Brown Belt",
    "1st Class Brown Belt",
    "2nd Class Brown Belt",
    "Black Belt",
]

# Belt choices for Django model fields
BELT_CHOICES = [(belt, belt) for belt in BELT_LEVELS]

# Mapping for quick lookup of belt index
BELT_INDEX_MAP = {belt: idx for idx, belt in enumerate(BELT_LEVELS)}

# Color codes for belt visualization
BELT_COLORS = {
    "White Belt": "#FFFFFF",
    "Yellow Belt": "#FFD700",
    "Orange Belt": "#FFA500",
    "Green Belt": "#00AA00",
    "Purple Belt": "#9932CC",
    "1st Class Purple Belt": "#7B2CBF",
    "Brown Belt": "#8B4513",
    "1st Class Brown Belt": "#654321",
    "2nd Class Brown Belt": "#3C2415",
    "Black Belt": "#000000",
}

# Some UI/registration workflows use short belt names like "White" instead of "White Belt".
BELT_ALIAS_MAP = {
    "white": "White Belt",
    "white belt": "White Belt",
    "yellow": "Yellow Belt",
    "yellow belt": "Yellow Belt",
    "orange": "Orange Belt",
    "orange belt": "Orange Belt",
    "green": "Green Belt",
    "green belt": "Green Belt",
    "purple": "Purple Belt",
    "purple belt": "Purple Belt",
    "1st class purple": "1st Class Purple Belt",
    "1st class purple belt": "1st Class Purple Belt",
    "brown": "Brown Belt",
    "brown belt": "Brown Belt",
    "1st class brown": "1st Class Brown Belt",
    "1st class brown belt": "1st Class Brown Belt",
    "2nd class brown": "2nd Class Brown Belt",
    "2nd class brown belt": "2nd Class Brown Belt",
    "black": "Black Belt",
    "black belt": "Black Belt",
}


def normalize_belt_name(belt: str) -> str:
    """Normalize a belt name to the canonical value used by the progression system."""
    if not belt:
        return ""

    cleaned = belt.strip()
    if cleaned in BELT_INDEX_MAP:
        return cleaned

    lower_cleaned = cleaned.lower()
    if lower_cleaned in BELT_ALIAS_MAP:
        return BELT_ALIAS_MAP[lower_cleaned]

    return cleaned


def get_next_belt(current_belt: str) -> str:
    """Get the next belt level after the current one."""
    normalized_belt = normalize_belt_name(current_belt)
    if not normalized_belt or normalized_belt not in BELT_INDEX_MAP:
        return BELT_LEVELS[0]

    current_index = BELT_INDEX_MAP[normalized_belt]
    if current_index < len(BELT_LEVELS) - 1:
        return BELT_LEVELS[current_index + 1]

    return normalized_belt  # Already at Black Belt


def get_belt_progression_percentage(current_belt: str) -> int:
    """Get the progression percentage (0-100) for a belt."""
    if not current_belt or current_belt not in BELT_INDEX_MAP:
        return 0
    
    current_index = BELT_INDEX_MAP[current_belt]
    total_belts = len(BELT_LEVELS)
    return int((current_index / (total_belts - 1)) * 100) if total_belts > 1 else 100


def get_belt_level_number(belt: str) -> int:
    """Get the numeric level (1-10) for a belt."""
    if belt not in BELT_INDEX_MAP:
        return 0
    
    return BELT_INDEX_MAP[belt] + 1


def is_valid_belt(belt: str) -> bool:
    """Check if a belt name is valid."""
    return belt in BELT_INDEX_MAP


def get_belt_by_index(index: int) -> str:
    """Get belt name by its index position."""
    if 0 <= index < len(BELT_LEVELS):
        return BELT_LEVELS[index]
    return ""


def get_belt_tier(belt: str) -> str:
    """Get the tier category of a belt (White, Yellow, Orange, Green, Purple, Brown, Black)."""
    if not belt or belt not in BELT_INDEX_MAP:
        return "Unknown"
    
    # Extract the main color without class designation
    if "1st Class" in belt:
        return belt.replace("1st Class ", "")
    elif "2nd Class" in belt:
        return belt.replace("2nd Class ", "")
    else:
        return belt


def get_belts_by_tier(tier: str) -> list:
    """Get all belts of a specific tier."""
    return [belt for belt in BELT_LEVELS if get_belt_tier(belt) == tier]


def calculate_progression_points(
    current_belt: str,
    kata_score: float,
    kumite_score: float,
    discipline_score: float,
    attendance_percentage: float,
) -> dict:
    """
    Calculate progression readiness points for a student.
    
    Returns:
        dict: Contains individual scores and overall readiness percentage
    """
    return {
        "kata_readiness": min(kata_score, 100.0),
        "kumite_readiness": min(kumite_score, 100.0),
        "discipline_readiness": min(discipline_score, 100.0),
        "attendance_readiness": min(attendance_percentage, 100.0),
        "overall_readiness": (
            (kata_score + kumite_score + discipline_score + attendance_percentage) / 4
        ),
    }
