from pydantic import BaseModel


class AppleLoginRequest(BaseModel):
    identity_token: str
    email: str | None = None
    display_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    is_admin: bool
    is_active: bool = True
