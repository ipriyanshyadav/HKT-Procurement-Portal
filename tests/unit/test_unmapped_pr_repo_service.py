from __future__ import annotations
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest

from app.core.exceptions import AppException
from app.db.enums import UnmappedPrStatusEnum
from app.modules.master_data.models import Category
from app.modules.requisition.models import Requisition, UnmappedPrException, UnmappedPrMappingLog
from app.modules.unmapped_pr.repository import UnmappedPrRepository
from app.modules.unmapped_pr.service import UnmappedPRService


@pytest.mark.asyncio
async def test_unmapped_pr_repo_list():
    repo = UnmappedPrRepository()
    mock_db = AsyncMock()

    mock_count_res = MagicMock()
    mock_count_res.scalar_one.return_value = 1

    mock_items_res = MagicMock()
    mock_items_res.scalars.return_value.all.return_value = [MagicMock(spec=UnmappedPrException)]

    mock_db.execute.side_effect = [mock_count_res, mock_items_res]

    org_id = uuid4()
    items, total = await repo.list(mock_db, org_id, status=UnmappedPrStatusEnum.PENDING)
    assert total == 1
    assert len(items) == 1


@pytest.mark.asyncio
async def test_unmapped_pr_repo_history_and_dashboard():
    repo = UnmappedPrRepository()
    mock_db = AsyncMock()

    mock_hist_res = MagicMock()
    mock_hist_res.scalar_one_or_none.return_value = MagicMock(spec=UnmappedPrMappingLog)
    mock_hist_res.scalars.return_value.all.return_value = [MagicMock(spec=UnmappedPrMappingLog)]

    mock_dash_res = MagicMock()
    mock_dash_res.all.return_value = [
        (0, 3, Decimal("3000.0")),
        (1, 2, Decimal("2000.0")),
        (2, 1, Decimal("1000.0")),
    ]

    mock_db.execute.side_effect = [mock_hist_res, mock_hist_res, mock_dash_res]

    org_id = uuid4()
    found = await repo.get_mapping_history(mock_db, org_id, "category_id", "source")
    assert found is not None

    similar = await repo.get_similar_history(mock_db, org_id)
    assert len(similar) == 1

    dash = await repo.get_dashboard_data(mock_db, org_id)
    assert dash["total_pending"] == 6
    assert dash["total_blocked_value"] == Decimal("6000.0")


@pytest.mark.asyncio
async def test_unmapped_pr_service_suggest_and_auto_map():
    repo = AsyncMock()
    svc = UnmappedPRService(repo=repo)
    mock_db = AsyncMock()

    org_id = uuid4()
    exc_id = uuid4()
    actor_id = uuid4()

    exc = MagicMock(spec=UnmappedPrException)
    exc.id = exc_id
    exc.requisition_id = uuid4()
    exc.failed_fields = {"category": "Laptops"}
    repo.get_by_id.return_value = exc

    cat_id = uuid4()
    log1 = MagicMock(spec=UnmappedPrMappingLog)
    log1.field_name = "category_id"
    log1.mapped_to_id = cat_id

    repo.find_historical_mapping.return_value = None
    repo.get_similar_history.return_value = [log1]

    mock_cat = MagicMock(spec=Category)
    mock_cat.id = cat_id
    mock_cat.name = "IT Equipment"

    mock_cat_res = MagicMock()
    mock_cat_res.scalar_one_or_none.return_value = mock_cat
    mock_db.execute.return_value = mock_cat_res

    res = await svc.suggest_mapping(mock_db, exc_id, org_id)
    assert res["confidence"] == 1.0
    assert res["auto_apply"] is True

    # Test auto_map success
    with patch.object(svc, "map_pr", new_callable=AsyncMock) as mock_map:
        mock_map.return_value = MagicMock(spec=Requisition)
        pr = await svc.auto_map(mock_db, exc_id, actor_id, org_id)
        assert pr is not None
        mock_map.assert_awaited_once()

    # Test auto_map low confidence error
    with patch.object(svc, "suggest_mapping", new_callable=AsyncMock, return_value={"confidence": 0.5}):
        with pytest.raises(AppException):
            await svc.auto_map(mock_db, exc_id, actor_id, org_id)
