from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import create_db_and_tables
from app.api.routes_firs import router as firs_router
from app.api.routes_rest import router as rest_router
from app.api.routes_alerts import router as alerts_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        create_db_and_tables()
    except Exception as e:
        print(f"WARNING: DB not available at startup ({e}). Tables will be created on first request.")
    yield


app = FastAPI(
    title="Bob Engine — FIR Intelligence & Crime Pattern Detector",
    description="Surfaces pattern correlations across FIR records using deterministic entity resolution and MO-similarity clustering.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "bob-engine"}


app.include_router(firs_router, prefix="/firs", tags=["FIRs"])
app.include_router(rest_router, tags=["Intelligence"])
app.include_router(alerts_router, prefix="/alerts", tags=["Alerts"])
