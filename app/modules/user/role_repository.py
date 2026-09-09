from __future__ import annotations
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from app.db.repository_base import BaseRepository
from app.modules.user.models import Role, UserRoleAssignment, RolePermission, Permission


class RoleRepository(BaseRepository[Role]):
    def __init__(self) -> None:
        super().__init__(Role)

    async def get_user_role_codes(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> list[str]:
        stmt = (
            select(Role.code)
            .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
            .where(
                and_(
                    UserRoleAssignment.user_id == user_id,
                    or_(Role.org_id == org_id, Role.is_system_role.is_(True)),
                    Role.is_active.is_(True),
                    Role.deleted_at.is_(None),
                )
            )
            .distinct()
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def user_has_permission(
        self, db: AsyncSession, user_id: UUID, org_id: UUID, permission_code: str
    ) -> bool:
        stmt = (
            select(Permission.id)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
            .where(
                and_(
                    UserRoleAssignment.user_id == user_id,
                    or_(Role.org_id == org_id, Role.is_system_role.is_(True)),
                    Permission.code == permission_code,
                    Role.is_active.is_(True),
                )
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def get_roles_with_permissions(
        self, db: AsyncSession, org_id: UUID
    ) -> list[dict]:
        stmt = (
            select(Role)
            .where(
                or_(Role.org_id == org_id, Role.is_system_role.is_(True)),
                Role.deleted_at.is_(None),
            )
            .order_by(Role.code.asc())
        )
        res = await db.execute(stmt)
        all_roles = res.scalars().all()

        # Deduplicate roles by code, preferring org-scoped role
        roles_map: dict[str, Role] = {}
        for r in all_roles:
            if r.code not in roles_map or r.org_id == org_id:
                roles_map[r.code] = r
        roles = sorted(roles_map.values(), key=lambda r: r.code)
        selected_role_ids = [r.id for r in roles]

        rp_stmt = (
            select(RolePermission.role_id, Permission.code)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(RolePermission.role_id.in_(selected_role_ids))
        )
        rp_res = await db.execute(rp_stmt)
        rp_rows = rp_res.all()

        role_perm_map: dict[UUID, set[str]] = {}
        for role_id, perm_code in rp_rows:
            role_perm_map.setdefault(role_id, set()).add(perm_code)

        return [
            {
                "id": str(r.id),
                "code": r.code,
                "name": r.name,
                "description": r.description or "",
                "is_system_role": r.is_system_role,
                "is_supplier_role": r.is_supplier_role,
                "is_active": r.is_active,
                "permissions_count": len(role_perm_map.get(r.id, set())),
                "permissions": sorted(role_perm_map.get(r.id, set())),
            }
            for r in roles
        ]

    async def get_all_permissions(
        self,
        db: AsyncSession,
        org_id: UUID,
        module: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[dict]:
        stmt = select(Permission)
        if module and module.upper() != "ALL":
            stmt = stmt.where(Permission.module.ilike(module))
        if search:
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Permission.code).like(term),
                    func.lower(Permission.name).like(term),
                    func.lower(Permission.description).like(term),
                )
            )
        stmt = stmt.order_by(Permission.module.asc(), Permission.code.asc())
        res = await db.execute(stmt)
        perms = res.scalars().all()

        # Deduplicate roles for org_id
        roles_stmt = (
            select(Role)
            .where(
                or_(Role.org_id == org_id, Role.is_system_role.is_(True)),
                Role.is_active.is_(True),
                Role.deleted_at.is_(None),
            )
        )
        all_roles = (await db.execute(roles_stmt)).scalars().all()
        roles_map: dict[str, Role] = {}
        for r in all_roles:
            if r.code not in roles_map or r.org_id == org_id:
                roles_map[r.code] = r
        selected_role_ids = [r.id for r in roles_map.values()]

        rp_stmt = (
            select(RolePermission.permission_id, Role.code)
            .join(Role, Role.id == RolePermission.role_id)
            .where(Role.id.in_(selected_role_ids))
            .distinct()
        )
        rp_res = await db.execute(rp_stmt)
        perm_roles_map: dict[UUID, set[str]] = {}
        for perm_id, role_code in rp_res.all():
            perm_roles_map.setdefault(perm_id, set()).add(role_code)

        return [
            {
                "id": str(p.id),
                "code": p.code,
                "name": p.name,
                "module": p.module,
                "description": p.description or "",
                "assigned_roles": sorted(perm_roles_map.get(p.id, set())),
            }
            for p in perms
        ]

    async def get_permissions_matrix(self, db: AsyncSession, org_id: UUID) -> dict:
        roles_stmt = (
            select(Role)
            .where(
                or_(Role.org_id == org_id, Role.is_system_role.is_(True)),
                Role.is_active.is_(True),
                Role.deleted_at.is_(None),
            )
            .order_by(Role.code.asc())
        )
        all_roles = (await db.execute(roles_stmt)).scalars().all()

        # Deduplicate roles by code, preferring org-scoped role
        roles_map: dict[str, Role] = {}
        for r in all_roles:
            if r.code not in roles_map or r.org_id == org_id:
                roles_map[r.code] = r
        roles = sorted(roles_map.values(), key=lambda r: r.code)
        selected_role_ids = [r.id for r in roles]

        perms_stmt = select(Permission).order_by(Permission.module.asc(), Permission.code.asc())
        perms = (await db.execute(perms_stmt)).scalars().all()

        rp_stmt = (
            select(Role.code, Permission.code)
            .join(RolePermission, RolePermission.role_id == Role.id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(Role.id.in_(selected_role_ids))
            .distinct()
        )
        rp_rows = (await db.execute(rp_stmt)).all()
        matrix: dict[str, set[str]] = {}
        for r_code, p_code in rp_rows:
            matrix.setdefault(r_code, set()).add(p_code)

        return {
            "roles": [
                {
                    "id": str(r.id),
                    "code": r.code,
                    "name": r.name,
                    "is_system_role": r.is_system_role,
                    "is_supplier_role": r.is_supplier_role,
                    "description": r.description or "",
                }
                for r in roles
            ],
            "permissions": [
                {
                    "id": str(p.id),
                    "code": p.code,
                    "name": p.name,
                    "module": p.module,
                    "description": p.description or "",
                }
                for p in perms
            ],
            "matrix": {k: sorted(v) for k, v in matrix.items()},
        }

    async def toggle_role_permission(
        self,
        db: AsyncSession,
        org_id: UUID,
        role_code: str,
        permission_code: str,
        granted: bool,
        actor_id: UUID,
    ) -> bool:
        from app.core.exceptions import AppException
        from sqlalchemy import case

        role_stmt = (
            select(Role)
            .where(
                Role.code == role_code,
                or_(Role.org_id == org_id, Role.is_system_role.is_(True)),
                Role.deleted_at.is_(None),
            )
            .order_by(case((Role.org_id == org_id, 1), else_=2))
            .limit(1)
        )
        role = (await db.execute(role_stmt)).scalar_one_or_none()
        if not role:
            raise AppException(f"Role '{role_code}' not found", "NOT_FOUND")

        perm_stmt = select(Permission).where(Permission.code == permission_code)
        perm = (await db.execute(perm_stmt)).scalar_one_or_none()
        if not perm:
            raise AppException(f"Permission '{permission_code}' not found", "NOT_FOUND")

        rp_stmt = select(RolePermission).where(
            RolePermission.role_id == role.id,
            RolePermission.permission_id == perm.id,
        )
        rp = (await db.execute(rp_stmt)).scalar_one_or_none()

        if granted:
            if not rp:
                new_rp = RolePermission(
                    org_id=role.org_id,
                    role_id=role.id,
                    permission_id=perm.id,
                    granted_by=actor_id,
                )
                db.add(new_rp)
                await db.commit()
                return True
        else:
            if rp:
                await db.delete(rp)
                await db.commit()
                return True
        return False


role_repository = RoleRepository()
