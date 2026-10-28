import os
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

# Support DATABASE_URL, Vercel POSTGRES_URL, or Neon/Supabase URLs automatically
raw_db_url = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_URL")
    or os.environ.get("POSTGRES_PRISMA_URL")
    or os.environ.get("NEON_DATABASE_URL")
    or ""
).strip()

if raw_db_url:
    # Normalize Heroku/Vercel postgres:// to postgresql:// for SQLAlchemy 2.0+
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

    # Clean query parameters that psycopg2 does not recognize (e.g., pgbouncer, supa)
    parsed = urlparse(raw_db_url)
    q_params = dict(parse_qsl(parsed.query))
    for unsupported_key in ("pgbouncer", "supa", "schema"):
        q_params.pop(unsupported_key, None)
    if parsed.hostname and parsed.hostname not in ("localhost", "127.0.0.1") and "sslmode" not in q_params:
        q_params["sslmode"] = "require"
    DATABASE_URL = urlunparse(parsed._replace(query=urlencode(q_params)))
elif os.environ.get("VERCEL"):
    DATABASE_URL = "sqlite:////tmp/ath_lubricants.db"
else:
    DATABASE_URL = "sqlite:///./ath_lubricants.db"

is_sqlite = DATABASE_URL.startswith("sqlite")
is_serverless = bool(os.environ.get("VERCEL"))

engine_kwargs = {
    "connect_args": {"check_same_thread": False} if is_sqlite else {},
    "pool_pre_ping": True,
}

# Use NullPool on Vercel serverless with PostgreSQL to prevent connection exhaustion
if not is_sqlite and is_serverless:
    engine_kwargs["poolclass"] = NullPool

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
    finally:
        db.close()