import asyncpg
import os
import asyncio

DATABASE_URL = os.environ["SUPABASE_DB_URL"]

from urllib.parse import urlparse

u = urlparse(DATABASE_URL)  # or SUPABASE_DB_URL, whichever you use
print("HOST:", u.hostname)
print("PORT:", u.port)
print("DB:", u.path)
print("QUERY:", u.query)

_pool = None
_lock = asyncio.Lock()

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        async with _lock:
            if _pool is None:
                _pool = await asyncpg.create_pool(
                    DATABASE_URL,
                    min_size=1,
                    max_size=10,
                )
    return _pool