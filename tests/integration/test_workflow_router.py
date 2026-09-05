from __future__ import annotations
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.db.enums import (
    WorkflowInstanceStatusEnum,
    ApprovalTaskStatusEnum,
    UserStatusEnum,
)
from app.db.session import get_db
from app.main import app
from app.modules.user.models import User
from app.modules.user.role_repository import role_repository
from app.modules.workflow.models import (
    WorkflowInstance,
    WorkflowTask,
    WorkflowTemplate,
)


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.org_id = uuid4()
    user.email = "approver@example.com"
    user.first_name = "Approver"
    user.last_name = "User"
    user.status = UserStatusEnum.ACTIVE
    user.is_supplier_user = False
    return user


@pytest.fixture
def client(mock_user):
    async def _fake_db():
        mock = AsyncMock()
        mock.execute = AsyncMock()
        mock.commit = AsyncMock()
        mock.flush = AsyncMock()
        mock.refresh = AsyncMock()
        mock.add = MagicMock()
        yield mock

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[get_current_user] = lambda: mock_user

    with patch.object(role_repository, "user_has_permission", new_callable=AsyncMock, return_value=True):
        yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.mark.integration
class TestWorkflowRouter:
    def _make_instance(self, org_id):
        return WorkflowInstance(
            id=uuid4(),
            org_id=org_id,
            template_id=uuid4(),
            entity_type="PURCHASE_REQUISITION",
            entity_id=uuid4(),
            status=WorkflowInstanceStatusEnum.ACTIVE,
            current_step_number=1,
            entity_context={},
            started_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    def _make_task(self, org_id, instance_id, user_id):
        return WorkflowTask(
            id=uuid4(),
            org_id=org_id,
            workflow_instance_id=instance_id,
            step_number=1,
            assigned_to=user_id,
            status=ApprovalTaskStatusEnum.PENDING,
            sla_status="WITHIN_SLA",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )



    def test_get_instance(self, client, mock_user):
        instance = self._make_instance(mock_user.org_id)
        with patch("app.modules.workflow.router.workflow_engine._repo.get_instance", new_callable=AsyncMock, return_value=instance):
            res = client.get(f"/api/v1/workflows/instances/{instance.id}")
            assert res.status_code == 200
            assert res.json()["data"]["id"] == str(instance.id)

    def test_get_my_tasks(self, client, mock_user):
        instance_id = uuid4()
        task = self._make_task(mock_user.org_id, instance_id, mock_user.id)
        with patch("app.modules.workflow.router.workflow_engine._repo.get_pending_tasks_by_user", new_callable=AsyncMock, return_value=[task]), \
             patch("app.modules.workflow.router.workflow_engine._repo.count_pending_tasks_by_user", new_callable=AsyncMock, return_value=1):
            res = client.get("/api/v1/workflows/tasks/my")
            assert res.status_code == 200
            data = res.json()["data"]
            assert len(data) == 1
            assert data[0]["id"] == str(task.id)

    def test_approve_task(self, client, mock_user):
        instance = self._make_instance(mock_user.org_id)
        task_id = uuid4()
        with patch("app.modules.workflow.router.workflow_engine.advance", new_callable=AsyncMock, return_value=instance):
            res = client.post(
                f"/api/v1/workflows/instances/{instance.id}/tasks/{task_id}/approve",
                json={"comment": "Approved by lead"},
            )
            assert res.status_code == 200

    def test_reject_task(self, client, mock_user):
        instance = self._make_instance(mock_user.org_id)
        task_id = uuid4()
        with patch("app.modules.workflow.router.workflow_engine.advance", new_callable=AsyncMock, return_value=instance):
            res = client.post(
                f"/api/v1/workflows/instances/{instance.id}/tasks/{task_id}/reject",
                json={"comment": "Over budget"},
            )
            assert res.status_code == 200

    def test_return_task(self, client, mock_user):
        instance = self._make_instance(mock_user.org_id)
        task_id = uuid4()
        with patch("app.modules.workflow.router.workflow_engine.advance", new_callable=AsyncMock, return_value=instance):
            res = client.post(
                f"/api/v1/workflows/instances/{instance.id}/tasks/{task_id}/return",
                json={"comment": "Please add quotation"},
            )
            assert res.status_code == 200

    def test_cancel_instance(self, client, mock_user):
        instance = self._make_instance(mock_user.org_id)
        with patch("app.modules.workflow.router.workflow_engine.cancel", new_callable=AsyncMock, return_value=instance):
            res = client.post(
                f"/api/v1/workflows/instances/{instance.id}/cancel",
                json={"reason": "Requisition revoked"},
            )
            assert res.status_code == 200

    def test_pause_and_resume_instance(self, client, mock_user):
        instance = self._make_instance(mock_user.org_id)
        with patch("app.modules.workflow.router.workflow_engine.pause", new_callable=AsyncMock, return_value=instance), \
             patch("app.modules.workflow.router.workflow_engine.resume", new_callable=AsyncMock, return_value=instance):
            res_pause = client.post(f"/api/v1/workflows/instances/{instance.id}/pause")
            assert res_pause.status_code == 200

            res_resume = client.post(f"/api/v1/workflows/instances/{instance.id}/resume")
            assert res_resume.status_code == 200

    def test_force_advance(self, client, mock_user):
        instance = self._make_instance(mock_user.org_id)
        with patch("app.modules.workflow.router.workflow_engine.force_advance", new_callable=AsyncMock, return_value=instance):
            res = client.post(
                f"/api/v1/workflows/instances/{instance.id}/force-advance",
                json={"reason": "Emergency procurement override"},
            )
            assert res.status_code == 200

    def test_simulate(self, client):
        with patch("app.modules.workflow.router.workflow_engine.simulate", new_callable=AsyncMock, return_value=[{"step": 1}]):
            res = client.post(
                "/api/v1/workflows/simulate",
                json={
                    "template_code": "PR_STANDARD",
                    "entity_context": {"total_amount": 5000},
                },
            )
            assert res.status_code == 200
            assert "chain" in res.json()["data"]

    def test_list_templates(self, client, mock_user):
        tmpl = WorkflowTemplate(
            id=uuid4(),
            org_id=mock_user.org_id,
            code="PR_STANDARD",
            name="PR Standard Approval",
            entity_type="PURCHASE_REQUISITION",
            steps=[],
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [tmpl]

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_result)
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        res = client.get("/api/v1/workflows/templates?entity_type=PURCHASE_REQUISITION")
        assert res.status_code == 200
        assert len(res.json()["data"]) == 1

    def test_create_template(self, client, mock_user):
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = None  # No conflict

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            mock.add = MagicMock()
            mock.commit = AsyncMock()
            mock.refresh = AsyncMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        res = client.post(
            "/api/v1/workflows/templates",
            json={
                "code": "CUSTOM_FLOW",
                "name": "Custom Flow",
                "entity_type": "CONTRACT",
                "steps": [{"step_number": 1, "step_name": "Review", "resolver": "ROLE", "resolver_config": {"role_code": "LEGAL"}}],
                "is_active": True,
            },
        )
        assert res.status_code == 200
        assert res.json()["data"]["code"] == "CUSTOM_FLOW"

    def test_get_template_detail(self, client, mock_user):
        tmpl = WorkflowTemplate(
            id=uuid4(),
            org_id=mock_user.org_id,
            code="PR_STANDARD",
            name="PR Standard Approval",
            entity_type="PURCHASE_REQUISITION",
            steps=[],
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = tmpl

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        res = client.get(f"/api/v1/workflows/templates/{tmpl.id}")
        assert res.status_code == 200
        assert res.json()["data"]["id"] == str(tmpl.id)

    def test_update_template(self, client, mock_user):
        tmpl = WorkflowTemplate(
            id=uuid4(),
            org_id=mock_user.org_id,
            code="PR_STANDARD",
            name="PR Standard Approval",
            entity_type="PURCHASE_REQUISITION",
            steps=[],
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = tmpl

        async def _fake_db():
            mock = AsyncMock()
            mock.execute = AsyncMock(return_value=mock_res)
            mock.commit = AsyncMock()
            mock.refresh = AsyncMock()
            yield mock

        app.dependency_overrides[get_db] = _fake_db
        res = client.put(
            f"/api/v1/workflows/templates/{tmpl.id}",
            json={"name": "Updated Flow Name", "is_active": True},
        )
        assert res.status_code == 200
