from __future__ import annotations

import asyncio
import pytest

from app.tasks.async_runner import get_worker_loop, reset_worker_loop, run_async


def test_run_async_basic():
    async def sample_coro(val: int) -> int:
        await asyncio.sleep(0.01)
        return val * 2

    res = run_async(sample_coro(21))
    assert res == 42


def test_run_async_preserves_loop():
    loop1 = get_worker_loop()
    assert not loop1.is_closed()

    async def coro():
        return "hello"

    res = run_async(coro())
    assert res == "hello"

    loop2 = get_worker_loop()
    assert loop1 is loop2


def test_reset_worker_loop():
    loop1 = get_worker_loop()
    reset_worker_loop()
    loop2 = get_worker_loop()
    assert loop1 is not loop2


@pytest.mark.asyncio
async def test_run_async_inside_existing_running_loop():
    async def inner_coro(x: int) -> int:
        return x + 5

    # Calling run_async when a loop is already actively running in this thread
    res = run_async(inner_coro(10))
    assert res == 15
