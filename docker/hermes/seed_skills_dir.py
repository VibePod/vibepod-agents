"""Point Hermes at VibePod's mounted skills directory, once.

Run by the container entrypoint on every start. Adds
``skills.external_dirs: ["/config/.agents/skills"]`` to Hermes' config.yaml
when the user has not configured external skill directories themselves.

Uses hermes_cli.config's public API (``save_config(merge_existing=True)`` is
upstream's sanctioned partial-save path) so comments in config.yaml survive
and the write stays atomic.
"""

from __future__ import annotations

import sys

TARGET_DIR = "/config/.agents/skills"


def main() -> int:
    """Seed the external skills directory unless the user already set one."""
    from hermes_cli.config import ensure_hermes_home, read_raw_config, save_config

    ensure_hermes_home()

    raw = read_raw_config() or {}
    skills = raw.get("skills")
    # Key presence, not truthiness: `external_dirs: []` is a deliberate "no
    # external skill directories", and the entrypoint reseeds on every start,
    # so a falsey check would silently undo that choice on each restart.
    if isinstance(skills, dict) and "external_dirs" in skills:
        return 0

    save_config({"skills": {"external_dirs": [TARGET_DIR]}}, merge_existing=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
