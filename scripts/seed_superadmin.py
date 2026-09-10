"""
Seed Super Admin User and assign all system roles.
Usage:
    .venv/bin/python scripts/seed_superadmin.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import and_, select
from app.core.constants import DEFAULT_ORG_ID, RoleCode
from app.core.security import hash_password
from app.db.enums import UserStatusEnum, VendorStatusEnum
from app.db.session import async_session
from app.modules.user.models import Role, User, UserRoleAssignment
from app.modules.vendor.models import Vendor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seed_superadmin")

SUPERADMIN_EMAIL = "superadmin@procurement.com"
SUPERADMIN_PASSWORD = "SuperAdmin123456!@#"


async def seed_superadmin() -> None:
    async with async_session() as db:
        logger.info("Checking for active vendor for supplier context...")
        v_res = await db.execute(
            select(Vendor).where(
                and_(Vendor.org_id == DEFAULT_ORG_ID, Vendor.status == VendorStatusEnum.ACTIVE)
            ).order_by(Vendor.vendor_code.asc()).limit(1)
        )
        vendor = v_res.scalar_one_or_none()
        vendor_id = vendor.id if vendor else None
        if vendor:
            logger.info("Found default vendor %s (%s) for Super Admin context", vendor.company_name, vendor.vendor_code)

        # 1. Upsert Super Admin User
        u_res = await db.execute(
            select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == SUPERADMIN_EMAIL))
        )
        user = u_res.scalar_one_or_none()

        if not user:
            user = User(
                org_id=DEFAULT_ORG_ID,
                email=SUPERADMIN_EMAIL,
                password_hash=hash_password(SUPERADMIN_PASSWORD),
                first_name="Alexander",
                last_name="Vance",
                employee_id="EMP-SUPER",
                status=UserStatusEnum.ACTIVE,
                mfa_enabled=False,
                is_supplier_user=False,
                vendor_id=vendor_id,
            )
            db.add(user)
            await db.flush()
            logger.info("Created Super Admin user: %s (ID: %s)", SUPERADMIN_EMAIL, user.id)
        else:
            user.first_name = "Alexander"
            user.last_name = "Vance"
            user.password_hash = hash_password(SUPERADMIN_PASSWORD)
            user.status = UserStatusEnum.ACTIVE
            if vendor_id and not user.vendor_id:
                user.vendor_id = vendor_id
            await db.flush()
            logger.info("Updated existing Super Admin user: %s (ID: %s)", SUPERADMIN_EMAIL, user.id)

        # 2. Query all active system and org roles
        roles_res = await db.execute(
            select(Role).where(
                and_(
                    Role.is_active.is_(True),
                    Role.deleted_at.is_(None),
                )
            )
        )
        all_roles = roles_res.scalars().all()
        logger.info("Found %d active system roles", len(all_roles))

        # 3. Assign all roles to Super Admin
        assigned_count = 0
        for role in all_roles:
            assignment_res = await db.execute(
                select(UserRoleAssignment).where(
                    and_(
                        UserRoleAssignment.user_id == user.id,
                        UserRoleAssignment.role_id == role.id,
                    )
                )
            )
            existing = assignment_res.scalar_one_or_none()
            if not existing:
                db.add(
                    UserRoleAssignment(
                        org_id=DEFAULT_ORG_ID,
                        user_id=user.id,
                        role_id=role.id,
                        is_active=True,
                    )
                )
                assigned_count += 1

        # Also ensure admin@procurement.com has SUPERADMIN role assigned if it exists
        admin_res = await db.execute(
            select(User).where(and_(User.org_id == DEFAULT_ORG_ID, User.email == "admin@procurement.com"))
        )
        admin_user = admin_res.scalar_one_or_none()
        if admin_user:
            superadmin_role = next((r for r in all_roles if r.code == RoleCode.SUPERADMIN), None)
            if superadmin_role:
                a_check = await db.execute(
                    select(UserRoleAssignment).where(
                        and_(
                            UserRoleAssignment.user_id == admin_user.id,
                            UserRoleAssignment.role_id == superadmin_role.id,
                        )
                    )
                )
                if not a_check.scalar_one_or_none():
                    db.add(
                        UserRoleAssignment(
                            org_id=DEFAULT_ORG_ID,
                            user_id=admin_user.id,
                            role_id=superadmin_role.id,
                            is_active=True,
                        )
                    )
                    logger.info("Assigned SUPERADMIN role to admin@procurement.com")

        await db.commit()
        logger.info("Successfully seeded Super Admin with %d new role assignments!", assigned_count)
        logger.info("Login credentials: %s / %s", SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)


if __name__ == "__main__":
    asyncio.run(seed_superadmin())
