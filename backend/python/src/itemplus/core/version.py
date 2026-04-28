from pathlib import Path
import subprocess


def _version_file_candidates() -> list[Path]:
    here = Path(__file__).resolve()
    candidates: list[Path] = []
    seen: set[Path] = set()

    for start in [Path.cwd(), here.parent]:
        current = start
        for parent in [current, *current.parents]:
            candidate = parent / "VERSION"
            if candidate not in seen:
                seen.add(candidate)
                candidates.append(candidate)

    return candidates


def load_shared_version_parts() -> tuple[str, str]:
    app_version = "1.0"
    app_build = "dev"

    for candidate in _version_file_candidates():
        if not candidate.exists():
            continue

        for raw_line in candidate.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = [part.strip() for part in line.split("=", 1)]
            if key == "APP_VERSION" and value:
                app_version = value
            elif key == "APP_BUILD" and value:
                app_build = value
        break

    if app_build == "dev":
        app_build = _git_short_commit() or app_build

    return app_version, app_build


def _git_short_commit() -> str | None:
    for candidate in _version_file_candidates():
        repo_root = candidate.parent
        try:
            result = subprocess.run(
                ["git", "-C", str(repo_root), "rev-parse", "--short", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
            )
        except Exception:
            continue

        short_hash = result.stdout.strip()
        if short_hash:
            return short_hash

    return None


def load_shared_version() -> str:
    app_version, app_build = load_shared_version_parts()
    return f"{app_version} build {app_build}"
