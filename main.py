"""
Meet Navigator — FastAPI-сервер.
"""

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import sessions


app = FastAPI(
    title="Meet Navigator",
    description="Двусторонний навигатор встречи",
    version="0.4.0",
)


# ============================================================
# CORS — разрешаем запросы отовсюду (для APK, WebView, других доменов)
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Подключаем папку static
app.mount("/static", StaticFiles(directory="static"), name="static")


class CreateRoomRequest(BaseModel):
    custom_code: Optional[str] = None
    name: str = "Участник"


class PositionUpdate(BaseModel):
    code: str
    role: str
    name: str = "Участник"
    lat: float
    lng: float
    accuracy: float = 0.0


class LeaveRequest(BaseModel):
    role: str = "guest"


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "meet-navigator", "version": "0.4.0"}


@app.post("/api/room/create")
async def create_room(req: CreateRoomRequest):
    try:
        room = sessions.create_room(custom_code=req.custom_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if room.host:
        room.host.name = req.name
    return {"code": room.code, "role": "host"}


@app.post("/api/room/{code}/join")
async def join_room(code: str):
    room = sessions.join_room(code)
    if room is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    return {"code": room.code, "role": "guest"}


@app.post("/api/room/{code}/leave")
async def leave_room(code: str, req: LeaveRequest):
    ok = sessions.leave_room(code.upper(), req.role)
    if not ok:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    return {"status": "ok"}


@app.get("/api/room/{code}/state")
async def room_state(code: str):
    state = sessions.get_room_state(code)
    if state is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    return state


@app.post("/api/room/{code}/position")
async def update_position(code: str, pos: PositionUpdate):
    ok = sessions.update_position(
        code=code.upper(),
        role=pos.role,
        name=pos.name,
        lat=pos.lat,
        lng=pos.lng,
        accuracy=pos.accuracy,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Комната или роль не найдены")
    return {"status": "ok"}