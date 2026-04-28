import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from itemplus.core.config import settings

logger = logging.getLogger("itemplus.debug")
if settings.debug_http:
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
from itemplus.core.database import Base, engine
from itemplus.models import AppSetting, archive, collection  # noqa: F401 — register models
from itemplus.routers import admin, auth, branding, checkout, device, printer, qr_login, stats, user, websocket
from itemplus.routers.realm import create_realm_router

# Ensure upload directory exists before mounting
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.enable_api_docs else None,
    redoc_url="/redoc" if settings.enable_api_docs else None,
    openapi_url="/openapi.json" if settings.enable_api_docs else None,
)

# CORS — disable credentials when wildcard origin is used (browser security requirement)
_allow_credentials = "*" not in settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Debug logging middleware — activate with ITEMPLUS_DEBUG_HTTP=true env var
# Extremely verbose: logs every request/response body. Do NOT use in production.
if settings.debug and settings.debug_http:
    @app.middleware("http")
    async def debug_log(request: Request, call_next):
        content_type = request.headers.get("content-type", "")
        body = await request.body()
        if body and "multipart" not in content_type:
            logger.info(">>> %s %s — %s", request.method, request.url.path, body.decode(errors="replace")[:2000])
        elif body:
            logger.info(">>> %s %s — [file upload, %d bytes]", request.method, request.url.path, len(body))

        response = await call_next(request)

        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
        response_body = b"".join(chunks)
        resp_type = response.headers.get("content-type", "")
        if response_body and "json" in resp_type:
            logger.info("<<< %s %s — %s", response.status_code, request.url.path, response_body.decode(errors="replace")[:2000])

        return Response(
            content=response_body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )

# Static files
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# All API routes under /api
api = APIRouter(prefix="/api")
api.include_router(admin.router)
api.include_router(auth.router)
api.include_router(branding.router)
api.include_router(user.router)
api.include_router(checkout.router)
api.include_router(stats.router)
api.include_router(device.router)
api.include_router(printer.router)
api.include_router(qr_login.router)
api.include_router(create_realm_router("archive", archive))
api.include_router(create_realm_router("collection", collection))
api.include_router(websocket.router)  # TODO: remove /api/ws after iOS app migration


@api.get("/health")
async def health():
    return {"status": "ok", "app": "itemplus", "version": settings.app_version}


app.include_router(api)

# WebSocket at /ws (canonical)
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {"name": settings.app_name, "version": settings.app_version}
