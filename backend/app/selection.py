import math
from typing import List, Dict, Optional
from geopy.geocoders import Nominatim


_geolocator = Nominatim(user_agent="my_building_finder_v1", timeout=5)

# ---------- geometry helpers ----------

def bearing_deg(lat1, lon1, lat2, lon2):
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    x = math.sin(dlam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def angle_delta_deg(a, b):
    """Smallest circular difference"""
    return abs(((a - b + 540) % 360) - 180)


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))


# ---------- main selector ----------

def pick_house(
    user_lat: float,
    user_lon: float,
    heading_deg: float,
    houses: List[Dict],
    radius_m: float,
    cone_deg: float = 60.0,
) -> Optional[Dict]:
    """
    houses: list of {house_id, lat, lon}
    returns: best house dict with score info, or None
    """
    heading_deg = heading_deg % 360.0
    best = None
    best_score = -1.0

    for h in houses:
        lat2 = float(h["lat"])
        lon2 = float(h["lon"])

        dist = haversine_m(user_lat, user_lon, lat2, lon2)
        if dist <= 1.0 or dist > radius_m:
            continue

        bearing = bearing_deg(user_lat, user_lon, lat2, lon2)
        delta = angle_delta_deg(bearing, heading_deg)

        # must be generally in front
        if delta > cone_deg:
            continue

        # score: prefer small delta, then closer distance
        angle_score = 1.0 - (delta / cone_deg)         # 0..1
        dist_score  = max(0.0, 1.0 - (dist / radius_m)) # 0..1
        score = 0.80 * angle_score + 0.20 * dist_score

        if score > best_score:
            best_score = score
            best = {
                "house_id": h["house_id"],
                "lat": lat2,
                "lon": lon2,
                "bearing_deg": bearing,
                "delta_deg": delta,
                "distance_m": dist,
                "confidence": round(score, 3),
            }

    return best


def get_building_name_free(lat: float, lon: float):
    try:
        location = _geolocator.reverse(f"{lat}, {lon}", zoom=18, addressdetails=True)
        if not location:
            return {"display_name": None, "address": {}}

        raw = location.raw
        return {
            "display_name": raw.get("display_name"),
            "address": raw.get("address", {}),
            "osm_type": raw.get("osm_type"),
            "osm_id": raw.get("osm_id"),
        }
    except Exception as e:
        return {"error": str(e), "display_name": None, "address": {}}
