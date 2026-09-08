from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_any_permission, require_permission
from app.core.constants import PermissionCode
from app.core.exceptions import ForbiddenError
from app.core.pagination import PaginationMeta, PaginationParams
from app.core.permissions import user_has_permission
from app.core.responses import APIResponse, created_response, success_response
from app.core.streaming import stream_csv
from app.db.session import get_db
from app.modules.document.service import document_service
from app.modules.ticket.models import Ticket
from app.modules.ticket.schemas import (
    AutomationRuleCreateRequest,
    AutomationRuleResponse,
    AutomationRuleUpdateRequest,
    CustomFieldDefCreateRequest,
    CustomFieldDefResponse,
    CustomFieldDefUpdateRequest,
    CustomFieldValueResponse,
    TicketActivityLogResponse,
    TicketAssignRequest,
    TicketAttachmentResponse,
    TicketCommentEditRequest,
    TicketCommentRequest,
    TicketCommentResponse,
    TicketCreateRequest,
    TicketDetailResponse,
    TicketEscalateRequest,
    TicketFilters,
    TicketLinkCreateRequest,
    TicketLinkResponse,
    TicketListResponse,
    TicketReopenRequest,
    TicketResolveRequest,
    TicketSearchRequest,
    TicketSLAConfigRequest,
    TicketUpdateRequest,
    TicketWatcherRequest,
    TicketWatcherResponse,
)
from app.modules.ticket.service import ticket_service

router = APIRouter(tags=["tickets"])

require_ticket_view = require_any_permission(
    PermissionCode.TICKET_VIEW_OWN,
    PermissionCode.TICKET_VIEW_TEAM,
    PermissionCode.TICKET_VIEW_ALL,
)


def _is_supplier(current_user) -> bool:
    return bool(getattr(current_user, "is_supplier_user", False))


def _to_detail_response(
    ticket: Ticket,
    links: list | None = None,
    custom_fields: list | None = None,
) -> TicketDetailResponse:
    from sqlalchemy import inspect as sa_inspect
    insp = sa_inspect(ticket)
    unloaded = insp.unloaded if insp is not None else set()

    comments = []
    if "comments" not in unloaded:
        for c in getattr(ticket, "comments", []) or []:
            if getattr(c, "deleted_at", None) is None:
                comments.append(TicketCommentResponse.model_validate(c))

    watchers = []
    if "watchers" not in unloaded:
        for w in getattr(ticket, "watchers", []) or []:
            if getattr(w, "deleted_at", None) is None:
                watchers.append(TicketWatcherResponse.model_validate(w))

    activity_logs = []
    if "activity_logs" not in unloaded:
        for a in getattr(ticket, "activity_logs", []) or []:
            activity_logs.append(TicketActivityLogResponse.model_validate(a))

    attachments = []
    if "attachments" not in unloaded:
        for att in getattr(ticket, "attachments", []) or []:
            if getattr(att, "deleted_at", None) is None:
                attachments.append(TicketAttachmentResponse.model_validate(att))

    formatted_links = []
    if links is not None:
        for l in links:
            if isinstance(l, dict):
                formatted_links.append(TicketLinkResponse(**l))
            else:
                formatted_links.append(TicketLinkResponse.model_validate(l))

    formatted_cfs = []
    if custom_fields is not None:
        for cf in custom_fields:
            if isinstance(cf, dict):
                formatted_cfs.append(CustomFieldValueResponse(**cf))
            else:
                formatted_cfs.append(CustomFieldValueResponse.model_validate(cf))

    base_dict = TicketListResponse.model_validate(ticket).model_dump()
    base_dict.update({
        "comments": comments,
        "watchers": watchers,
        "activity_logs": activity_logs,
        "attachments": attachments,
        "links": formatted_links,
        "custom_fields": formatted_cfs,
    })
    return TicketDetailResponse(**base_dict)


# --- Dashboard ---
@router.get("/dashboard")
async def get_dashboard(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dashboard = await ticket_service.get_dashboard(db, current_user.id, current_user.org_id)
    return success_response(dashboard)


# --- SLA Config (Admin) ---
@router.get("/sla-config")
async def get_sla_configs(
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_SLA)),
    db: AsyncSession = Depends(get_db),
):
    configs = await ticket_service.repo.get_all_sla_configs(db, current_user.org_id)
    return success_response(configs)


@router.put("/sla-config")
async def update_sla_configs(
    data: list[TicketSLAConfigRequest],
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_SLA)),
    db: AsyncSession = Depends(get_db),
):
    result = await ticket_service.update_sla_config(db, data, current_user.id, current_user.org_id)
    await db.commit()
    return success_response(result)


# --- Custom Fields (Admin / Config) ---
@router.get("/custom-fields/definitions")
async def list_custom_field_defs(
    ticket_type: str | None = None,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    defs = await ticket_service.get_custom_field_defs(db, current_user.org_id, ticket_type)
    return success_response([CustomFieldDefResponse.model_validate(d) for d in defs])


@router.post("/custom-fields/definitions", status_code=status.HTTP_201_CREATED)
async def create_custom_field_def(
    data: CustomFieldDefCreateRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_CUSTOM_FIELDS)),
    db: AsyncSession = Depends(get_db),
):
    cf_def = await ticket_service.create_custom_field_def(db, data, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(cf_def)
    return created_response(CustomFieldDefResponse.model_validate(cf_def))


@router.put("/custom-fields/definitions/{field_def_id}")
async def update_custom_field_def(
    field_def_id: UUID,
    data: CustomFieldDefUpdateRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_CUSTOM_FIELDS)),
    db: AsyncSession = Depends(get_db),
):
    cf_def = await ticket_service.update_custom_field_def(db, field_def_id, data, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(cf_def)
    return success_response(CustomFieldDefResponse.model_validate(cf_def))


@router.delete("/custom-fields/definitions/{field_def_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_field_def(
    field_def_id: UUID,
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_CUSTOM_FIELDS)),
    db: AsyncSession = Depends(get_db),
):
    await ticket_service.delete_custom_field_def(db, field_def_id, current_user.id, current_user.org_id)
    await db.commit()


# --- Automation Rules (Admin / Jira-style No-Code Engine) ---
@router.get("/automation/rules")
async def list_automation_rules(
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_AUTOMATION)),
    db: AsyncSession = Depends(get_db),
):
    rules = await ticket_service.get_automation_rules(db, current_user.org_id)
    return success_response([AutomationRuleResponse.model_validate(r) for r in rules])


@router.post("/automation/rules", status_code=status.HTTP_201_CREATED)
async def create_automation_rule(
    data: AutomationRuleCreateRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_AUTOMATION)),
    db: AsyncSession = Depends(get_db),
):
    rule = await ticket_service.create_automation_rule(db, data, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(rule)
    return created_response(AutomationRuleResponse.model_validate(rule))


@router.put("/automation/rules/{rule_id}")
async def update_automation_rule(
    rule_id: UUID,
    data: AutomationRuleUpdateRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_AUTOMATION)),
    db: AsyncSession = Depends(get_db),
):
    rule = await ticket_service.update_automation_rule(db, rule_id, data, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(rule)
    return success_response(AutomationRuleResponse.model_validate(rule))


@router.delete("/automation/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation_rule(
    rule_id: UUID,
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_AUTOMATION)),
    db: AsyncSession = Depends(get_db),
):
    await ticket_service.delete_automation_rule(db, rule_id, current_user.id, current_user.org_id)
    await db.commit()


@router.post("/automation/rules/{rule_id}/run/{ticket_id}")
async def run_automation_rule_manually(
    rule_id: UUID,
    ticket_id: UUID,
    current_user=Depends(require_permission(PermissionCode.TICKET_CONFIG_AUTOMATION)),
    db: AsyncSession = Depends(get_db),
):
    result = await ticket_service.run_automation_rule(db, rule_id, ticket_id, current_user.id, current_user.org_id)
    await db.commit()
    return success_response(result)


# --- Export ---
@router.get("/export")
async def export_tickets(
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    current_user=Depends(require_permission(PermissionCode.TICKET_EXPORT)),
    db: AsyncSession = Depends(get_db),
):
    filters = TicketFilters(status=status_filter, priority=priority, limit=100000, offset=0)
    tickets, _ = await ticket_service.get_list(
        db, filters, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    rows = [
        {
            "number": t.ticket_number,
            "title": t.title,
            "type": str(t.ticket_type),
            "priority": str(t.priority),
            "status": str(t.status),
            "due_date": t.due_date.isoformat() if t.due_date else "",
            "created": t.created_at.isoformat() if t.created_at else "",
        }
        for t in tickets
    ]
    headers = ["number", "title", "type", "priority", "status", "due_date", "created"]
    filename = f"tickets_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    return stream_csv(headers, rows, filename)


# --- Search ---
@router.post("/search")
async def search_tickets(
    data: TicketSearchRequest,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    is_admin = await ticket_service._is_admin(db, current_user.id, current_user.org_id)
    results = await ticket_service.search_service.search(
        current_user.org_id,
        data.query,
        data.filters or {},
        actor_id=current_user.id,
        is_admin=is_admin,
        db=db,
    )
    return success_response(results)


# --- Specialized listing routes ---
@router.get("/my/raised")
async def list_my_raised_tickets(
    params: PaginationParams = Depends(),
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    filters = TicketFilters(view_scope="my_tickets", limit=params.limit, offset=params.offset)
    tickets, total = await ticket_service.get_list(
        db, filters, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    meta = PaginationMeta(total=total, page=params.page, page_size=params.limit)
    return success_response(
        [TicketListResponse.model_validate(t) for t in tickets],
        meta=meta,
    )


@router.get("/my/assigned")
async def list_my_assigned_tickets(
    params: PaginationParams = Depends(),
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    filters = TicketFilters(view_scope="assigned_to_me", limit=params.limit, offset=params.offset)
    tickets, total = await ticket_service.get_list(
        db, filters, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    meta = PaginationMeta(total=total, page=params.page, page_size=params.limit)
    return success_response(
        [TicketListResponse.model_validate(t) for t in tickets],
        meta=meta,
    )


@router.get("/entity/{entity_type}/{entity_id}")
async def list_tickets_for_entity(
    entity_type: str,
    entity_id: UUID,
    params: PaginationParams = Depends(),
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    filters = TicketFilters(
        entity_type=entity_type,
        entity_id=entity_id,
        limit=params.limit,
        offset=params.offset,
    )
    tickets, total = await ticket_service.get_list(
        db, filters, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    meta = PaginationMeta(total=total, page=params.page, page_size=params.limit)
    return success_response(
        [TicketListResponse.model_validate(t) for t in tickets],
        meta=meta,
    )


# --- Core CRUD ---
@router.get("", response_model=APIResponse[list[TicketListResponse]])
async def list_tickets(
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    ticket_type: str | None = None,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    view_scope: str | None = None,
    tags: list[str] | None = Query(None),
    due_date_from: str | None = None,
    due_date_to: str | None = None,
    search: str | None = None,
    params: PaginationParams = Depends(),
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    if search:
        is_admin = await ticket_service._is_admin(db, current_user.id, current_user.org_id)
        results = await ticket_service.search_service.search(
            current_user.org_id,
            search,
            {"status": status_filter, "priority": priority, "ticket_type": ticket_type},
            actor_id=current_user.id,
            is_admin=is_admin,
            db=db,
        )
        return success_response(results)

    from datetime import date as d_date
    parsed_due_from = d_date.fromisoformat(due_date_from) if due_date_from else None
    parsed_due_to = d_date.fromisoformat(due_date_to) if due_date_to else None

    filters = TicketFilters(
        status=status_filter,
        priority=priority,
        ticket_type=ticket_type,
        entity_type=entity_type,
        entity_id=entity_id,
        view_scope=view_scope,
        tags=tags,
        due_date_from=parsed_due_from,
        due_date_to=parsed_due_to,
        limit=params.limit,
        offset=params.offset,
    )
    tickets, total = await ticket_service.get_list(
        db, filters, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    meta = PaginationMeta(total=total, page=params.page, page_size=params.limit)
    return success_response([TicketListResponse.model_validate(t) for t in tickets], meta=meta)


@router.post("", response_model=APIResponse[TicketDetailResponse], status_code=status.HTTP_201_CREATED)
async def create_ticket(
    data: TicketCreateRequest,
    request: Request,
    current_user=Depends(require_permission(PermissionCode.TICKET_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    portal = getattr(request.state, "portal", "buyer")
    ticket = await ticket_service.create(db, data, current_user.id, current_user.org_id, portal)
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket.id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket.id, current_user.org_id)
    return created_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.get("/{ticket_id}", response_model=APIResponse[TicketDetailResponse])
async def get_ticket(
    ticket_id: UUID,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.get_detail(
        db, ticket_id, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.put("/{ticket_id}", response_model=APIResponse[TicketDetailResponse])
async def update_ticket(
    ticket_id: UUID,
    data: TicketUpdateRequest,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.update(db, ticket_id, data, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(
    ticket_id: UUID,
    current_user=Depends(require_permission(PermissionCode.TICKET_VIEW_ALL)),
    db: AsyncSession = Depends(get_db),
):
    await ticket_service.soft_delete(db, ticket_id, current_user.id, current_user.org_id)
    await db.commit()


# --- Transitions ---
@router.post("/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: UUID,
    data: TicketAssignRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_ASSIGN)),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.assign(
        db, ticket_id, data.user_id, data.team, current_user.id, current_user.org_id
    )
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.post("/{ticket_id}/start-progress")
async def start_progress(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.start_progress(db, ticket_id, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.post("/{ticket_id}/resolve")
async def resolve_ticket(
    ticket_id: UUID,
    data: TicketResolveRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_RESOLVE)),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.resolve(
        db, ticket_id, data.resolution_note, current_user.id, current_user.org_id
    )
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.post("/{ticket_id}/close")
async def close_ticket(
    ticket_id: UUID,
    current_user=Depends(require_permission(PermissionCode.TICKET_CLOSE)),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.close(
        db, ticket_id, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.post("/{ticket_id}/reopen")
async def reopen_ticket(
    ticket_id: UUID,
    data: TicketReopenRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_REOPEN)),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.reopen(
        db, ticket_id, data.reason, current_user.id, current_user.org_id, _is_supplier(current_user)
    )
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.post("/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: UUID,
    data: TicketEscalateRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_ESCALATE)),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.escalate(
        db,
        ticket_id,
        data.reason,
        data.escalate_to_user_id,
        current_user.id,
        current_user.org_id,
    )
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


@router.post("/{ticket_id}/pending-response")
async def pending_response(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.set_pending_response(db, ticket_id, current_user.id, current_user.org_id)
    await db.commit()
    await db.refresh(ticket)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    cfs = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response(_to_detail_response(ticket, links=links, custom_fields=cfs))


# --- Comments ---
@router.get("/{ticket_id}/comments")
async def get_comments(
    ticket_id: UUID,
    cursor: str | None = None,
    limit: int = 20,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    comments, has_more = await ticket_service.get_comments(
        db, ticket_id, current_user.org_id, _is_supplier(current_user), cursor, limit
    )
    return success_response(
        [TicketCommentResponse.model_validate(c) for c in comments],
        meta={"has_more": has_more, "count": len(comments)},
    )


@router.post("/{ticket_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    ticket_id: UUID,
    data: TicketCommentRequest,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    if data.is_internal:
        has_perm = await user_has_permission(
            db, current_user.id, current_user.org_id, PermissionCode.TICKET_ADD_INTERNAL
        )
        if not has_perm:
            raise ForbiddenError(
                "Permission ticket.add_internal_note required to add internal note",
                "MISSING_INTERNAL_NOTE_PERMISSION",
            )

    comment = await ticket_service.add_comment(
        db,
        ticket_id,
        data.content,
        data.is_internal or False,
        current_user.id,
        current_user.org_id,
        _is_supplier(current_user),
    )
    await db.commit()
    await db.refresh(comment)
    return created_response(TicketCommentResponse.model_validate(comment))


@router.put("/{ticket_id}/comments/{comment_id}")
async def edit_comment(
    ticket_id: UUID,
    comment_id: UUID,
    data: TicketCommentEditRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await ticket_service.edit_comment(
        db, comment_id, data.content, current_user.id, current_user.org_id
    )
    await db.commit()
    await db.refresh(comment)
    return success_response(TicketCommentResponse.model_validate(comment))


@router.delete("/{ticket_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    ticket_id: UUID,
    comment_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ticket_service.delete_comment(db, comment_id, current_user.id, current_user.org_id)
    await db.commit()


# --- Watchers ---
@router.get("/{ticket_id}/watchers")
async def get_watchers(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    watchers = await ticket_service.repo.get_watchers(db, ticket_id, current_user.org_id)
    return success_response([TicketWatcherResponse.model_validate(w) for w in watchers])


@router.post("/{ticket_id}/watchers", status_code=status.HTTP_201_CREATED)
async def add_watcher(
    ticket_id: UUID,
    data: TicketWatcherRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    watcher = await ticket_service.add_watcher(
        db, ticket_id, data.user_id, current_user.id, current_user.org_id
    )
    await db.commit()
    await db.refresh(watcher)
    return created_response(TicketWatcherResponse.model_validate(watcher))


@router.delete("/{ticket_id}/watchers/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_watcher(
    ticket_id: UUID,
    user_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ticket_service.remove_watcher(db, ticket_id, user_id, current_user.id, current_user.org_id)
    await db.commit()


# --- Activity ---
@router.get("/{ticket_id}/activity")
async def get_activity(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    activity = await ticket_service.repo.get_activity(db, ticket_id, current_user.org_id)
    return success_response([TicketActivityLogResponse.model_validate(a) for a in activity])


# --- Attachments ---
@router.get("/{ticket_id}/attachments")
async def get_attachments(
    ticket_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await ticket_service.repo.get(db, ticket_id, current_user.org_id)
    attachments = getattr(ticket, "attachments", []) or []
    return success_response([TicketAttachmentResponse.model_validate(att) for att in attachments if not att.deleted_at])


@router.post("/{ticket_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    ticket_id: UUID,
    file: UploadFile = File(...),
    comment_id: UUID | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()
    doc = await document_service.upload(
        db=db,
        file_bytes=file_bytes,
        original_filename=file.filename or "attachment",
        document_type="TICKET_ATTACHMENT",
        entity_type="TICKET",
        entity_id=ticket_id,
        actor_id=current_user.id,
        org_id=current_user.org_id,
    )
    attachment = await ticket_service.attach_file(
        db,
        ticket_id=ticket_id,
        document_id=doc.id,
        file_name=file.filename or "attachment",
        actor_id=current_user.id,
        org_id=current_user.org_id,
        comment_id=comment_id,
    )
    await db.commit()
    await db.refresh(attachment)
    return created_response(TicketAttachmentResponse.model_validate(attachment))


@router.delete("/{ticket_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_attachment(
    ticket_id: UUID,
    attachment_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ticket_service.remove_attachment(
        db, ticket_id, attachment_id, current_user.id, current_user.org_id
    )
    await db.commit()


# --- Issue Links (Jira Linking) ---
@router.get("/{ticket_id}/links")
async def get_ticket_links(
    ticket_id: UUID,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    return success_response([TicketLinkResponse(**l) for l in links])


@router.post("/{ticket_id}/links", status_code=status.HTTP_201_CREATED)
async def create_ticket_link(
    ticket_id: UUID,
    data: TicketLinkCreateRequest,
    current_user=Depends(require_permission(PermissionCode.TICKET_LINK)),
    db: AsyncSession = Depends(get_db),
):
    link = await ticket_service.create_link(
        db, ticket_id, data.target_ticket_id, data.link_type, current_user.id, current_user.org_id
    )
    await db.commit()
    await db.refresh(link)
    links = await ticket_service.get_ticket_links(db, ticket_id, current_user.org_id)
    matched = next((l for l in links if l["id"] == link.id), None)
    if matched:
        return created_response(TicketLinkResponse(**matched))
    return created_response(TicketLinkResponse.model_validate(link))


@router.delete("/{ticket_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_ticket_link(
    ticket_id: UUID,
    link_id: UUID,
    current_user=Depends(require_permission(PermissionCode.TICKET_LINK)),
    db: AsyncSession = Depends(get_db),
):
    await ticket_service.remove_link(db, ticket_id, link_id, current_user.id, current_user.org_id)
    await db.commit()


# --- Ticket Custom Field Values ---
@router.get("/{ticket_id}/custom-fields")
async def get_ticket_custom_fields(
    ticket_id: UUID,
    current_user=Depends(require_ticket_view),
    db: AsyncSession = Depends(get_db),
):
    vals = await ticket_service.get_ticket_custom_field_values(db, ticket_id, current_user.org_id)
    return success_response([CustomFieldValueResponse(**v) for v in vals])
