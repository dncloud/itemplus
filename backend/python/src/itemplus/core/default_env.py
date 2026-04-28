from pathlib import Path


def _shared_default_env_candidates() -> list[Path]:
    here = Path(__file__).resolve()
    candidates: list[Path] = []
    seen: set[Path] = set()

    for start in [Path.cwd(), here.parent]:
        for parent in [start, *start.parents]:
            candidate = parent / "config" / "default.env"
            if candidate not in seen:
                seen.add(candidate)
                candidates.append(candidate)

    return candidates


def find_shared_default_env() -> Path | None:
    for candidate in _shared_default_env_candidates():
        if candidate.exists():
            return candidate
    return None


def ensure_local_env() -> Path:
    env_path = Path(".env").resolve()
    if env_path.exists():
        return env_path

    template_path = find_shared_default_env()
    if template_path is None:
        raise FileNotFoundError("Shared default config not found at config/default.env")

    env_path.write_text(template_path.read_text(encoding="utf-8"), encoding="utf-8")
    return env_path
