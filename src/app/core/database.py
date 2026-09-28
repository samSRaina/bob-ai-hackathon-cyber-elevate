from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=False)


def create_db_and_tables():
    # Import all models to ensure they are registered
    import app.models.fir_models  # noqa: F401
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
