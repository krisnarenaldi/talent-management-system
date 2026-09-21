"""
arq Redis pool — singleton connection pool untuk enqueue job dari FastAPI.

Cara pakai di endpoint:
    from app.core.arq_pool import get_redis_pool

    redis = await get_redis_pool()
    await redis.enqueue_job("process_cv_screening", str(screening_result.id))
"""
from __future__ import annotations

import logging

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: ArqRedis | None = None


async def get_redis_pool() -> ArqRedis:
    """Return (dan buat jika belum ada) singleton arq Redis pool."""
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
        logger.info("arq Redis pool dibuat: %s", settings.REDIS_URL)
    return _pool


async def close_redis_pool() -> None:
    """Tutup pool saat aplikasi shutdown (dipanggil dari lifespan FastAPI)."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        logger.info("arq Redis pool ditutup.")
