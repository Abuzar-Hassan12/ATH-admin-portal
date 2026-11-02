import os
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

# Automatically load .env (or .enve) from backend/ or project root for local development
try:
    from dotenv import load_dotenv
    backend_dir = Path(__file__).resolve().parent.parent
    root_dir = backend_dir.parent
    for candidate in (
        backend_dir / ".env",
        backend_dir / ".enve",
        root_dir / ".env",
        root_dir / ".enve",
    ):
        if candidate.exists():
            load_dotenv(dotenv_path=candidate, override=False)
except Exception:
    pass

# Support DATABASE_URL, Vercel POSTGRES_URL, or Neon/Supabase URLs automatically
raw_db_url = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_URL")
    or os.environ.get("POSTGRES_PRISMA_URL")
    or os.environ.get("NEON_DATABASE_URL")
    or ""
).strip().strip('"').strip("'")
if raw_db_url:
    # Normalize postgres:// or Neon's postgresql+psycopg:// to standard postgresql:// (psycopg2)
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    elif raw_db_url.startswith("postgresql+psycopg://"):
        raw_db_url = raw_db_url.replace("postgresql+psycopg://", "postgresql://", 1)
    elif raw_db_url.startswith("postgres+psycopg://"):
        raw_db_url = raw_db_url.replace("postgres+psycopg://", "postgresql://", 1)

    # Clean query parameters that psycopg2 does not recognize (e.g., pgbouncer, supa, schema, channel_binding)
    parsed = urlparse(raw_db_url)
    q_params = dict(parse_qsl(parsed.query))
    for unsupported_key in ("pgbouncer", "supa", "schema", "channel_binding"):
        q_params.pop(unsupported_key, None)
    if parsed.hostname and parsed.hostname not in ("localhost", "127.0.0.1") and "sslmode" not in q_params:
        q_params["sslmode"] = "require"
    DATABASE_URL = urlunparse(parsed._replace(scheme="postgresql+psycopg2", query=urlencode(q_params)))
elif os.environ.get("VERCEL"):
    DATABASE_URL = "sqlite:////tmp/ath_lubricants.db"
else:
    DATABASE_URL = "sqlite:///./ath_lubricants.db"

is_sqlite = DATABASE_URL.startswith("sqlite")
is_serverless = bool(os.environ.get("VERCEL"))
IS_PERSISTENT_POSTGRES = not is_sqlite

def _resolve_neon_hostaddr_if_dns_fails(db_url: str) -> dict:
    """
    If Windows/ISP DNS fails to resolve the Neon hostname ('Name or service not known'),
    automatically queries Cloudflare 1.1.1.1 over HTTPS (by IP literal, needing no local DNS)
    and supplies 'hostaddr' to psycopg2 while keeping 'host' intact for SSL verification.
    """
    extra_args = {
        "connect_timeout": 15,
        "keepalives": 1,
        "keepalives_idle": 20,
        "keepalives_interval": 5,
        "keepalives_count": 5,
    }
    try:
        host = urlparse(db_url).hostname
        if not host or host in ("localhost", "127.0.0.1"):
            return extra_args
        import socket
        try:
            socket.getaddrinfo(host, 5432)
            return extra_args
        except socket.gaierror:
            import json
            import urllib.request
            req = urllib.request.Request(
                f"https://1.1.1.1/dns-query?name={host}&type=A",
                headers={"Accept": "application/dns-json", "User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for ans in data.get("Answer", []):
                    if ans.get("type") == 1 and ans.get("data"):
                        extra_args["hostaddr"] = ans["data"]
                        break
    except Exception:
        pass
    return extra_args


engine_kwargs = {
    "connect_args": (
        {"check_same_thread": False}
        if is_sqlite
        else _resolve_neon_hostaddr_if_dns_fails(DATABASE_URL)
    ),
    "pool_pre_ping": True,
}

# Use NullPool on Vercel serverless; use warm connection pool locally with 180s recycle
if not is_sqlite:
    if is_serverless:
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 10
        engine_kwargs["pool_recycle"] = 180
        engine_kwargs["pool_timeout"] = 20

engine = create_engine(DATABASE_URL, **engine_kwargs)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()