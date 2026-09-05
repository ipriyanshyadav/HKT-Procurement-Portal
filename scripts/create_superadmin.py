import os
import sys
import asyncio
import logging
from uuid import UUID, uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_superadmin():
    email = os.environ.get("SUPERADMIN_EMAIL", "superadmin@example.com")
    password = os.environ.get("SUPERADMIN_PASSWORD", "SuperAdmin123!")
    org_name = os.environ.get("SUPERADMIN_ORG_NAME", "Default Organization")
    org_code = os.environ.get("SUPERADMIN_ORG_CODE", "DEFAULT")
    
    logger.info(f"Ensuring superadmin user: {email} for organization: {org_name}")
    try:
        from app.db.session import async_session
        from app.core.security import hash_password
        from app.db.enums import UserStatusEnum
        from app.modules.organization.models import Organization
        from app.modules.user.models import User, Role, UserRoleAssignment
        from sqlalchemy import select

        async with async_session() as db:
            res = await db.execute(select(Organization).limit(1))
            org = res.scalars().first()
            if not org:
                org = Organization(
                    id=UUID("00000000-0000-0000-0000-000000000001"),
                    name=org_name,
                    legal_name=org_name,
                    country_code="IN",
                    base_currency="INR",
                    settings={},
                    version=1,
                )
                db.add(org)
                await db.flush()

            res = await db.execute(select(User).where(User.email == email))
            user = res.scalars().first()
            if not user:
                user = User(
                    id=uuid4(),
                    org_id=org.id,
                    email=email,
                    password_hash=hash_password(password),
                    first_name="Super",
                    last_name="Admin",
                    status=UserStatusEnum.ACTIVE,
                    version=1,
                )
                db.add(user)
                await db.flush()

                res_role = await db.execute(select(Role).where(Role.code == "SUPERADMIN"))
                role = res_role.scalars().first()
                if not role:
                    role = Role(
                        id=uuid4(),
                        org_id=org.id,
                        code="SUPERADMIN",
                        name="Super Administrator",
                        is_system_role=True,
                        is_active=True,
                        version=1,
                    )
                    db.add(role)
                    await db.flush()

                assignment = UserRoleAssignment(
                    id=uuid4(),
                    org_id=org.id,
                    user_id=user.id,
                    role_id=role.id,
                )
                db.add(assignment)
                await db.commit()
                logger.info(f"Created superadmin user: {email}")
            else:
                logger.info(f"Superadmin user {email} already exists.")
    except Exception as e:
        logger.warning(f"Database superadmin ensure note: {e}")

    logger.info("Superadmin creation completed (idempotent).")

if __name__ == "__main__":
    asyncio.run(create_superadmin())

