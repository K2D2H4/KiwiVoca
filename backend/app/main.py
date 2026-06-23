"""키위보카 FastAPI 앱 진입점."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, decks, health
from app.routers import import_
from app.routers import study

app = FastAPI(title="KiwiVoca API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(decks.router)
app.include_router(import_.router)
app.include_router(study.router)


@app.get("/api")
def root():
    return {"name": "KiwiVoca API", "docs": "/docs"}
