"""Application settings — loaded from a local .env file.

If no .env exists yet, item+ creates one from the shared config/default.env template.
"""

import secrets
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from itemplus.core.default_env import ensure_local_env
from itemplus.core.version import load_shared_version

ENV_PATH = ensure_local_env()


def _get_or_create_secret() -> str:
    """Generate a persistent JWT secret on first run, stored in .jwt_secret file."""
    secret_file = ENV_PATH.with_name(".jwt_secret")
    if secret_file.exists():
        return secret_file.read_text().strip()
    secret = secrets.token_urlsafe(48)
    secret_file.write_text(secret)
    return secret


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str
    app_version: str = load_shared_version()
    app_domain: str = ""  # e.g. "itemplus.example.ltd"
    debug: bool
    debug_http: bool
    enable_api_docs: bool = False

    # Database
    database_url: str

    # JWT
    jwt_secret: str = ""  # Auto-generated if empty
    jwt_algorithm: str
    jwt_expiry_days: int

    # Apple Sign-In (optional — only needed for strict token verification)
    apple_team_id: str = ""
    apple_bundle_id: str = ""

    # CORS
    cors_origins: list[str]

    # Upload
    upload_dir: str
    max_upload_size: int

    # TSC Printer
    printer_host: str
    printer_port: int

    # SMTP (Magic Link)
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    smtp_from_email: str
    smtp_from_name: str
    smtp_use_tls: bool
    magic_link_expiry_minutes: int
    magic_link_base_url: str = ""  # derived from APP_DOMAIN if empty

    # Server
    host: str
    port: int

    @field_validator("upload_dir")
    @classmethod
    def validate_upload_dir(cls, value: str) -> str:
        return value


settings = Settings()


def _resolve_absolute_path(path_value: str) -> str:
    path = Path(path_value)
    if path.is_absolute():
        return str(path)
    return str((ENV_PATH.parent / path).resolve())


def _normalize_database_url(raw_url: str) -> str:
    prefix = "sqlite+aiosqlite:///"
    if not raw_url.startswith(prefix):
        return raw_url

    path_part = raw_url[len(prefix):]
    if not path_part:
        return raw_url

    db_path = Path(path_part)
    if db_path.is_absolute():
        return prefix + str(db_path)

    return prefix + str((ENV_PATH.parent / db_path).resolve())

# Auto-generate JWT secret if not provided
if not settings.jwt_secret:
    settings.jwt_secret = _get_or_create_secret()

# Normalize relative runtime paths against the local .env directory.
settings.database_url = _normalize_database_url(settings.database_url)
settings.upload_dir = _resolve_absolute_path(settings.upload_dir)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

# Derive magic_link_base_url from domain
if not settings.magic_link_base_url and settings.app_domain:
    settings.magic_link_base_url = f"https://{settings.app_domain}"
