from __future__ import annotations

import asyncio
from typing import Any, Coroutine, TypeVar

T = TypeVar("T")

_worker_loop: asyncio.AbstractEventLoop | None = None


def get_worker_loop() -> asyncio.AbstractEventLoop:
    """Get or create the persistent event loop for the current worker process."""
    global _worker_loop
    if _worker_loop is None or _worker_loop.is_closed():
        _worker_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_worker_loop)
    return _worker_loop


def reset_worker_loop() -> None:
    """Close and reset the event loop for the current worker process."""
    global _worker_loop
    if _worker_loop is not None and not _worker_loop.is_closed():
        try:
            _worker_loop.close()
        except Exception:
            pass
    _worker_loop = None


def run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Run an async coroutine synchronously, reusing a persistent process event loop.

    Avoids event loop creation and destruction overhead on high-frequency Celery tasks.
    """
    try:
        running_loop = asyncio.get_running_loop()
    except RuntimeError:
        running_loop = None

    if running_loop and running_loop.is_running():
        # Fallback if invoked inside an existing active event loop (e.g., during tests)
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(asyncio.run, coro).result()

    loop = get_worker_loop()
    return loop.run_until_complete(coro)
