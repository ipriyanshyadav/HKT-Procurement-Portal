"""Support Portal API Router — SPEC_29.

Layer: router
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.responses import APIResponse, created_response, success_response
from app.db.session import get_db
from app.modules.support.schemas import (
    KnowledgeBaseArticleResponse,
    SupportMetricsResponse,
    SupportTicketCreateRequest,
    SupportTicketCSATRequest,
    SupportTicketMessageCreateRequest,
    SupportTicketMessageResponse,
    SupportTicketResponse,
    SupportTicketUpdateRequest,
)
from app.modules.support.service import support_service
from app.modules.user.models import User

router = APIRouter(prefix="/support", tags=["Support & Helpdesk"])


@router.get("/tickets", response_model=APIResponse[list[SupportTicketResponse]])
async def list_support_tickets(
    status: str | None = Query(None),
    only_mine: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List support tickets within the current organization."""
    customer_id = current_user.id if only_mine else None
    tickets = await support_service.list_tickets(
        db, current_user.org_id, customer_id=customer_id, status=status, page=page, page_size=page_size
    )
    return success_response(tickets)


@router.post(
    "/tickets",
    response_model=APIResponse[SupportTicketResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_support_ticket(
    payload: SupportTicketCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Raise a new customer support or discrepancy inquiry ticket."""
    ticket = await support_service.create_ticket(db, current_user.org_id, current_user, payload)
    await db.commit()
    await db.refresh(ticket)
    return created_response(ticket)


@router.get("/tickets/{id}", response_model=APIResponse[SupportTicketResponse])
async def get_support_ticket(
    ticket_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve support ticket details and conversation thread."""
    ticket = await support_service.get_ticket(db, current_user.org_id, ticket_id)
    return success_response(ticket)


@router.post(
    "/tickets/{id}/messages",
    response_model=APIResponse[SupportTicketMessageResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_ticket_message(
    payload: SupportTicketMessageCreateRequest,
    ticket_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Post a message or response to an active support inquiry."""
    msg = await support_service.add_message(db, current_user.org_id, current_user, ticket_id, payload)
    await db.commit()
    await db.refresh(msg)
    return created_response(msg)


@router.patch("/tickets/{id}", response_model=APIResponse[SupportTicketResponse])
async def update_support_ticket(
    payload: SupportTicketUpdateRequest,
    ticket_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update ticket resolution status, assignment, or priority."""
    ticket = await support_service.update_ticket(
        db, current_user.org_id, current_user, ticket_id, payload
    )
    await db.commit()
    await db.refresh(ticket)
    return success_response(ticket)


@router.post("/tickets/{id}/csat", response_model=APIResponse[SupportTicketResponse])
async def submit_ticket_csat(
    payload: SupportTicketCSATRequest,
    ticket_id: UUID = Path(..., alias="id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit post-resolution customer satisfaction (CSAT) rating."""
    ticket = await support_service.submit_csat(db, current_user.org_id, ticket_id, payload)
    await db.commit()
    return success_response(ticket)


@router.get("/metrics", response_model=APIResponse[SupportMetricsResponse])
async def get_support_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve operational helpdesk performance and response metrics."""
    metrics = await support_service.get_metrics(db, current_user.org_id)
    return success_response(metrics)


@router.get("/kb", response_model=APIResponse[list[KnowledgeBaseArticleResponse]])
async def list_kb_articles(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve published knowledge base and self-service help articles."""
    articles = await support_service.list_kb_articles(db, category=category)
    return success_response(articles)
