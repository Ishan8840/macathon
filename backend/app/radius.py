from typing import List, Dict
from .db import get_pool

async def get_buildings_within_radius(
    user_lat: float,
    user_lng: float,
    heading_deg: float,
    radius_m: float = 100.0,
) -> List[Dict[str, float]]:
    pool = await get_pool()

    sql = """
    select
      centroid_lat,
      centroid_lon,
      6371000 * acos(
        cos(radians($1)) * cos(radians(centroid_lat)) *
        cos(radians(centroid_lon) - radians($2)) +
        sin(radians($1)) * sin(radians(centroid_lat))
      ) as distance_m
    from public.buildings
    where
      6371000 * acos(
        cos(radians($1)) * cos(radians(centroid_lat)) *
        cos(radians(centroid_lon) - radians($2)) +
        sin(radians($1)) * sin(radians(centroid_lat))
      ) <= $3
    order by distance_m;
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, user_lat, user_lng, radius_m)

    return [
        {
            "centroid_lat": float(r["centroid_lat"]),
            "centroid_lon": float(r["centroid_lon"]),
            "distance_m": float(r["distance_m"]),
        }
        for r in rows
    ]