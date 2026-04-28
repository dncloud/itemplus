"""FastAPI dependencies for authentication and permissions."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.database import get_db
from itemplus.core.security import decode_token
from itemplus.models.user import User

# auto_error=False so missing header doesn't 403 — we fall back to cookie
security = HTTPBearer(auto_error=False)

# All available permissions
PERMISSIONS = [
    "items.read",         # View items
    "items.write",        # Create/edit items
    "items.delete",       # Delete items
    "attachments.write",  # Upload/delete attachments, photos
    "checkout.manage",    # Checkout/checkin items (approve/reject requests)
    "print",              # Print QR labels
    "categories.read",    # View categories & properties
    "categories.write",   # Create/edit categories & properties
    "categories.delete",  # Delete categories & properties
    "locations.read",     # View locations
    "locations.write",    # Create/edit locations
    "locations.delete",   # Delete locations
    "vendors.read",       # View vendors
    "vendors.write",      # Create/edit vendors
    "vendors.delete",     # Delete vendors
]
# Admin-exclusive (not assignable as permissions):
# - users.manage → admin router uses get_current_admin
# - database.manage → admin router uses get_current_admin


def _extract_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    """Extract JWT from Authorization header or HttpOnly cookie."""
    if credentials:
        return credentials.credentials
    cookie_token = request.cookies.get("itemplus_token")
    if cookie_token:
        return cookie_token
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current active user from JWT token (header or cookie)."""
    token = _extract_token(request, credentials)
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = await db.scalar(select(User).where(User.id == payload["user_id"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account not activated")
    return user


async def get_current_user_allow_inactive(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get user from JWT (header or cookie), even if not yet activated."""
    token = _extract_token(request, credentials)
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = await db.scalar(select(User).where(User.id == payload["user_id"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin required")
    return user


def has_permission(user: User, perm: str) -> bool:
    """Check if user has a specific permission. Admins have all permissions."""
    if user.is_admin:
        return True
    return perm in (user.permissions or [])


def require_permission(*perms: str):
    """Dependency factory: require one or more permissions (any of them)."""
    async def check(user: User = Depends(get_current_user)) -> User:
        if user.is_admin:
            return user
        user_perms = user.permissions or []
        if not any(p in user_perms for p in perms):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Permission required: {' or '.join(perms)}")
        return user
    return check


def require_all_permissions(*perms: str):
    """Dependency factory: require every listed permission."""
    async def check(user: User = Depends(get_current_user)) -> User:
        if user.is_admin:
            return user
        user_perms = set(user.permissions or [])
        missing = [perm for perm in perms if perm not in user_perms]
        if missing:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Permissions required: {', '.join(missing)}")
        return user
    return check
