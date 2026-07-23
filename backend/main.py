from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from io import BytesIO
from user_agents import parse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import pandas as pd
from typing import List

import base64
import qrcode
import random
import string
import re
import os
import io

import models
import schemas
import security
import openpyxl


from database import SessionLocal, engine, Base

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
Base.metadata.create_all(bind=engine)
app = FastAPI()

limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

securityy = HTTPBearer()

def generate_short_code(length=6):
    characters = string.ascii_letters + string.digits
    return "".join(random.choices(characters, k=length))

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(securityy)):
    token = credentials.credentials
    payload = security.verify_Token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def get_current_admin(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)):

    user = db.query(models.User).filter(models.User.id == current_user["user_id"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="Current user not found")

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    return user


def generate_qr_base64(data: str) -> str:
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=4
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_base64}"



def create_short_url_logic(*, request: Request, db: Session, current_user: dict, url_data):
    user_id = current_user["user_id"]

    user_entry = db.query(models.User).filter(models.User.id == user_id).first()
    if not user_entry or not user_entry.is_active:
        raise HTTPException(status_code=403, detail="Your account has been banned.")

    base_url = str(request.base_url).rstrip("/")

    url_pattern = r"^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,20}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$"
    if not re.match(url_pattern, str(url_data.original_url)):
        raise HTTPException(status_code=400, detail="Invalid URL format.")

    if getattr(url_data, "custom_code", None) and url_data.custom_code.strip():
        short_code = url_data.custom_code.strip()

        custom_code_pattern = r"^[a-zA-Z0-9_-]{3,30}$"
        if not re.match(custom_code_pattern, short_code):
            raise HTTPException(
                status_code=400,
                detail="Custom code must be 3-30 characters and contain only letters, numbers, hyphens, or underscores."
            )

        existing_custom = db.query(models.URL).filter(models.URL.short_url == short_code).first()
        if existing_custom:
            raise HTTPException(status_code=400, detail="This custom code is already taken.")
    else:
        existing_url = db.query(models.URL).filter(
            models.URL.original_url == str(url_data.original_url),
            models.URL.user_id == user_id
        ).first()

        if existing_url:
            final_short_url = f"{base_url}/{existing_url.short_url}"
            qr_code_image = generate_qr_base64(final_short_url) if getattr(url_data, "qr_code", False) else None
            return {
                "short_url": final_short_url,
                "qr_code_image": qr_code_image
            }

        short_code = generate_short_code()
        while db.query(models.URL).filter(models.URL.short_url == short_code).first():
            short_code = generate_short_code()

    expires_at = None
    if getattr(url_data, "expiration_minutes", None) is not None:
        if url_data.expiration_minutes <= 0:
            raise HTTPException(status_code=400, detail="Expiration time must be greater than 0.")
        expires_at = datetime.utcnow() + timedelta(minutes=url_data.expiration_minutes)

    click_limit = None
    if getattr(url_data, "count_limit", None) is not None:
        if url_data.count_limit <= 0:
            raise HTTPException(status_code=400, detail="Count limit must be greater than 0.")
        click_limit = url_data.count_limit

    password_hash = None
    if getattr(url_data, "password", None) and url_data.password.strip():
        password_hash = security.hash_password(url_data.password.strip())

    new_url = models.URL(
        original_url=str(url_data.original_url),
        short_url=short_code,
        user_id=user_id,
        expires_at=expires_at,
        click_limit=click_limit,
        password_hash=password_hash,
        is_active=True
    )

    db.add(new_url)
    db.commit()
    db.refresh(new_url)

    final_short_url = f"{base_url}/{short_code}"
    qr_code_image = generate_qr_base64(final_short_url) if getattr(url_data, "qr_code", False) else None

    return {
        "short_url": final_short_url,
        "qr_code_image": qr_code_image
    }



@app.post("/signup/", response_model=schemas.UserResponse)
@limiter.limit("4/minute")
def create_user(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,20}$"
    if not re.match(email_pattern, user.email):
        raise HTTPException(status_code=400, detail="Invalid mail format.")

    password_pattern = r"^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[.@#$%^&+=])(?=\S+$).{4,20}$"
    if not re.match(password_pattern, user.password):
        raise HTTPException(status_code=400, detail="Invalid password format.")

    existing_user = db.query(models.User).filter(
        (models.User.username == user.username) | (models.User.email == user.email)
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    hashed_password = security.hash_password(user.password)

    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@app.post("/login/", response_model=schemas.TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, user: schemas.Userlogin, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()

    if not db_user or not security.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not db_user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been banned.")

    token_data = {"user_id": db_user.id, "username": db_user.username}
    access_token = security.create_Token(token_data)

    return schemas.TokenResponse(access_token=access_token)


@app.post("/change-password/", response_model=schemas.AdminMessageResponse)
@limiter.limit("3/minute")

def change_password(request: Request ,payload: schemas.ChangePasswordRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == payload.email).first()

    if not db_user or not security.verify_password(payload.current_password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or current password")

    password_pattern = r"^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[.@#$%^&+=])(?=\S+$).{4,20}$"
    if not re.match(password_pattern, payload.new_password):
        raise HTTPException(status_code=400, detail="Invalid password format.")

    db_user.hashed_password = security.hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully. Please log in with your new password."}


@app.post("/shorten", response_model=schemas.ShortenResponse)
@limiter.limit("10/minute")
def shorten_url(
    request: Request,
    url: schemas.URLCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = create_short_url_logic(
        request=request,
        db=db,
        current_user=current_user,
        url_data=url
    )

    return schemas.ShortenResponse(
        short_url=result["short_url"],
        qr_code_image=result["qr_code_image"]
    )

@app.get("/{short_code}")
def redirect_url(request: Request, short_code: str, db: Session = Depends(get_db)):
    url_entry = db.query(models.URL).filter(models.URL.short_url == short_code).first()

    if not url_entry:
        raise HTTPException(status_code=404, detail="Short URL not found")

    if url_entry.owner is None or not url_entry.owner.is_active:
        raise HTTPException(status_code=403, detail="This link's owner has been banned")

    if not url_entry.is_active:
        raise HTTPException(status_code=403, detail="This short URL is inactive")

    if url_entry.expires_at and url_entry.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=410, detail="Short URL has expired")

    if url_entry.click_limit is not None and url_entry.clicks >= url_entry.click_limit:
        url_entry.is_active = False
        db.commit()
        raise HTTPException(status_code=410, detail="Short URL click limit reached")
    

    if url_entry.password_hash is not None:
        return RedirectResponse(url=f"{FRONTEND_URL}/protected/{short_code}")    

    ua_string = request.headers.get("user-agent", "")
    user_agent = parse(ua_string)
    browser = user_agent.browser.family

    if user_agent.is_mobile:
        platform = "Mobile"
    elif user_agent.is_tablet:
        platform = "Tablet"
    elif user_agent.is_pc:
        platform = "PC"
    else:
        platform = "Other"

    url_stats = models.URLClick(
        url_id=url_entry.id,
        clicked_at=datetime.utcnow(),
        accessed_platform=platform,
        accessed_browser=browser,
        accessed_country=None,  # cannot get from user-agent
)

    db.add(url_stats)

    url_entry.clicks += 1

    if url_entry.click_limit is not None and url_entry.clicks >= url_entry.click_limit:
        url_entry.is_active = False

    db.commit()

    return RedirectResponse(url=url_entry.original_url)



@app.get("/api/my-urls", response_model=list[schemas.URLResponse])
def list_all_url(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    current_user_id = current_user["user_id"]
    url_results = db.query(models.URL).filter(models.URL.user_id == current_user_id).all()

    base_url = str(request.base_url).rstrip("/")

    return [
        {
            "id": url.id,
            "original_url": url.original_url,
            "short_url": f"{base_url}/{url.short_url}",
            "clicks": url.clicks,
            "is_active": url.is_active,
            "expires_at": url.expires_at,
            "click_limit": url.click_limit,
            "tags": url.tags,
        }
        for url in url_results
    ]


@app.delete("/api/delete-url/{id}")
def delete_url(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    current_user_id = current_user["user_id"]

    will_be_deleted = db.query(models.URL).filter(
        models.URL.id == id,
        models.URL.user_id == current_user_id
    ).first()

    if not will_be_deleted:
        raise HTTPException(status_code=404, detail="URL not found.")

    db.delete(will_be_deleted)
    db.commit()

    return {"message": f"URL with id {id} deleted successfully."}



@app.patch("/api/validate-url/{id}")
def validate_url(
    id: int,
    payload: schemas.URLValidationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    current_user_id = current_user["user_id"]

    url_entry = db.query(models.URL).filter(
        models.URL.id == id,
        models.URL.user_id == current_user_id
    ).first()

    if not url_entry:
        raise HTTPException(status_code=404, detail="URL not found")

    url_entry.is_active = payload.is_active
    db.commit()
    db.refresh(url_entry)

    return {
        "message": "URL status updated successfully",
        "id": url_entry.id,
        "is_active": url_entry.is_active
    }


# ----------------------------------------------------------------------
# TAG ENDPOINTS
# ----------------------------------------------------------------------

@app.post("/api/create-tag", response_model=schemas.TagResponse)
def create_tag(
    payload: schemas.TagCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty.")

    if len(name) > 30:
        raise HTTPException(status_code=400, detail="Tag name must be 30 characters or fewer.")

    existing = db.query(models.Tag).filter(
        models.Tag.user_id == user_id,
        func.lower(models.Tag.name) == name.lower()
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="You already have a tag with this name.")

    new_tag = models.Tag(name=name, user_id=user_id)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)

    return new_tag


@app.get("/api/my-tags", response_model=list[schemas.TagResponse])
def list_my_tags(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]
    return (
        db.query(models.Tag)
        .filter(models.Tag.user_id == user_id)
        .order_by(models.Tag.name)
        .all()
    )


@app.patch("/api/rename-tag/{tag_id}", response_model=schemas.TagResponse)
def rename_tag(
    tag_id: int,
    payload: schemas.TagUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    tag = db.query(models.Tag).filter(
        models.Tag.id == tag_id,
        models.Tag.user_id == user_id
    ).first()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found.")

    if payload.name is not None:
        new_name = payload.name.strip()

        if not new_name:
            raise HTTPException(status_code=400, detail="Tag name cannot be empty.")

        duplicate = db.query(models.Tag).filter(
            models.Tag.user_id == user_id,
            func.lower(models.Tag.name) == new_name.lower(),
            models.Tag.id != tag_id
        ).first()

        if duplicate:
            raise HTTPException(status_code=400, detail="You already have a tag with this name.")

        tag.name = new_name

    db.commit()
    db.refresh(tag)

    return tag


@app.patch("/api/change-tag/{url_id}", response_model=schemas.URLResponse)
def change_tag(
    url_id: int,
    payload: schemas.URLTagsUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    url_entry = db.query(models.URL).filter(
        models.URL.id == url_id,
        models.URL.user_id == user_id
    ).first()

    if not url_entry:
        raise HTTPException(status_code=404, detail="URL not found.")

    unique_tag_ids = list(set(payload.tag_ids))

    tags = db.query(models.Tag).filter(
        models.Tag.id.in_(unique_tag_ids),
        models.Tag.user_id == user_id
    ).all()

    found_ids = {tag.id for tag in tags}
    missing_ids = [tid for tid in unique_tag_ids if tid not in found_ids]

    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Tag id(s) {missing_ids} not found or don't belong to you."
        )

    # Replacing the whole collection lets SQLAlchemy add/remove association
    # rows in one shot — this single endpoint covers adding, removing, and
    # updating a URL's tags depending on what's in the new list.
    url_entry.tags = tags
    db.commit()
    db.refresh(url_entry)

    base_url = str(request.base_url).rstrip("/")

    return {
        "id": url_entry.id,
        "original_url": url_entry.original_url,
        "short_url": f"{base_url}/{url_entry.short_url}",
        "clicks": url_entry.clicks,
        "is_active": url_entry.is_active,
        "expires_at": url_entry.expires_at,
        "click_limit": url_entry.click_limit,
        "tags": url_entry.tags,
    }


@app.delete("/api/delete-tag/{tag_id}", response_model=schemas.AdminMessageResponse)
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    tag = db.query(models.Tag).filter(
        models.Tag.id == tag_id,
        models.Tag.user_id == user_id
    ).first()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found.")

    tag_name = tag.name
    db.delete(tag)
    db.commit()

    return {"message": f"Tag '{tag_name}' deleted successfully."}


# ----------------------------------------------------------------------


@app.get("/api/show-statistics/{id}", response_model=schemas.URLStatisticsResponse)
def show_statistics(
    id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    current_user_id = current_user["user_id"]

    url_entry = db.query(models.URL).filter(
        models.URL.id == id,
        models.URL.user_id == current_user_id
    ).first()

    if not url_entry:
        raise HTTPException(status_code=404, detail="URL not found")

    platform_stats = (
        db.query(models.URLClick.accessed_platform, func.count(models.URLClick.id))
        .filter(models.URLClick.url_id == id)
        .group_by(models.URLClick.accessed_platform)
        .all()
    )

    browser_stats = (
        db.query(models.URLClick.accessed_browser, func.count(models.URLClick.id))
        .filter(models.URLClick.url_id == id)
        .group_by(models.URLClick.accessed_browser)
        .all()
    )

    country_stats = (
        db.query(models.URLClick.accessed_country, func.count(models.URLClick.id))
        .filter(models.URLClick.url_id == id)
        .group_by(models.URLClick.accessed_country)
        .all()
    )

    total_clicks = (
        db.query(func.count(models.URLClick.id))
        .filter(models.URLClick.url_id == id)
        .scalar()
    )

    recent_clicks = (
        db.query(models.URLClick.clicked_at)
        .filter(models.URLClick.url_id == id)
        .order_by(models.URLClick.clicked_at.asc())
        .all()
    )

    return {
        "url_id": url_entry.id,
        "short_url": url_entry.short_url,
        "original_url": url_entry.original_url,
        "total_clicks": total_clicks,
        "by_platform": [
            {
                "label": platform if platform is not None else "Unknown",
                "count": count
            }
            for platform, count in platform_stats
        ],
        "by_browser": [
            {
                "label": browser if browser is not None else "Unknown",
                "count": count
            }
            for browser, count in browser_stats
        ],
        "by_country": [
            {
                "label": country if country is not None else "Unknown",
                "count": count
            }
            for country, count in country_stats
        ],
        "recent_clicks": [
            {
                "timestamp": clicked_at.isoformat(),
                "count": 1
            }
            for (clicked_at,) in recent_clicks
        ]
    }





@app.post("/api/protected/{short_code}", response_model=schemas.URLAccessResponse)
def verify_password(
    short_code: str,
    payload: schemas.URLPasswordRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    url_entry = db.query(models.URL).filter(models.URL.short_url == short_code).first()

    if not url_entry:
        raise HTTPException(status_code=404, detail="Short URL not found")

    if url_entry.owner is None or not url_entry.owner.is_active:
        raise HTTPException(status_code=403, detail="This link's owner has been banned")

    if not url_entry.is_active:
        raise HTTPException(status_code=403, detail="This short URL is inactive")

    if url_entry.expires_at and url_entry.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=410, detail="Short URL has expired")

    if url_entry.click_limit is not None and url_entry.clicks >= url_entry.click_limit:
        url_entry.is_active = False
        db.commit()
        raise HTTPException(status_code=410, detail="Short URL click limit reached")

    if url_entry.password_hash is None:
        raise HTTPException(status_code=400, detail="This URL is not password protected")

    if not security.verify_password(payload.password, url_entry.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")

    ua_string = request.headers.get("user-agent", "")
    user_agent = parse(ua_string)
    browser = user_agent.browser.family

    if user_agent.is_mobile:
        platform = "Mobile"
    elif user_agent.is_tablet:
        platform = "Tablet"
    elif user_agent.is_pc:
        platform = "PC"
    else:
        platform = "Other"

    url_stats = models.URLClick(
        url_id=url_entry.id,
        clicked_at=datetime.utcnow(),
        accessed_platform=platform,
        accessed_browser=browser,
        accessed_country=None,
    )

    db.add(url_stats)

    url_entry.clicks += 1

    if url_entry.click_limit is not None and url_entry.clicks >= url_entry.click_limit:
        url_entry.is_active = False

    db.commit()

    return {
        "message": "Password verified successfully",
        "original_url": url_entry.original_url
    }


@app.delete("/api/admin/delete-user/{user_id}", response_model=schemas.AdminMessageResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()

    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_delete.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete another admin")

    db.delete(user_to_delete)
    db.commit()

    return {"message": f"User with id {user_id} deleted successfully."}


@app.patch("/api/admin/ban-user/{user_id}", response_model=schemas.AdminMessageResponse)
def ban_user(
    user_id: int,
    payload: schemas.AdminUserBanRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    user_entry = db.query(models.User).filter(models.User.id == user_id).first()

    if not user_entry:
        raise HTTPException(status_code=404, detail="User not found")

    if user_entry.is_admin:
        raise HTTPException(status_code=400, detail="Cannot ban another admin")

    user_entry.is_active = payload.is_active
    db.commit()
    db.refresh(user_entry)

    return {"message": "User status updated successfully"}


@app.get("/api/admin/dashboard", response_model=schemas.AdminDashboardStats)
def admin_dashboard(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    total_users = db.query(func.count(models.User.id)).scalar()
    active_users = db.query(func.count(models.User.id)).filter(models.User.is_active == True).scalar()
    banned_users = total_users - active_users

    total_urls = db.query(func.count(models.URL.id)).scalar()
    active_urls = db.query(func.count(models.URL.id)).filter(models.URL.is_active == True).scalar()
    inactive_urls = total_urls - active_urls
    protected_urls = db.query(func.count(models.URL.id)).filter(models.URL.password_hash.isnot(None)).scalar()
    total_clicks = db.query(func.coalesce(func.sum(models.URL.clicks), 0)).scalar()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "banned_users": banned_users,
        "total_urls": total_urls,
        "active_urls": active_urls,
        "inactive_urls": inactive_urls,
        "protected_urls": protected_urls,
        "total_clicks": total_clicks,
    }


@app.get("/api/admin/users", response_model=list[schemas.AdminUserListItem])
def list_all_users(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    users = db.query(models.User).all()
    result = []
    for user in users:
        url_count = db.query(func.count(models.URL.id)).filter(models.URL.user_id == user.id).scalar()
        total_clicks = db.query(func.coalesce(func.sum(models.URL.clicks), 0)).filter(models.URL.user_id == user.id).scalar()
        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "url_count": url_count,
            "total_clicks": total_clicks,
        })
    return result


@app.get("/api/admin/user-urls/{user_id}", response_model=list[schemas.URLResponse])
def get_user_urls(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    url_results = db.query(models.URL).filter(models.URL.user_id == user_id).all()

    base_url = str(request.base_url).rstrip("/")

    return [
        {
            "id": url.id,
            "original_url": url.original_url,
            "short_url": f"{base_url}/{url.short_url}",
            "clicks": url.clicks,
            "is_active": url.is_active,
            "expires_at": url.expires_at,
            "click_limit": url.click_limit,
            "tags": url.tags,
        }
        for url in url_results
    ]

@app.get("/api/me", response_model=schemas.CurrentUserResponse)
def get_me(db: Session = Depends(get_db),current_user: dict = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == current_user["user_id"]).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user



@app.post("/api/bulk-upload", response_model=List[schemas.BulkUploadResult])
@limiter.limit("5/minute")
def bulk_upload(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    contents = file.file.read()
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Please upload a .csv, .xlsx, or .xls file."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    results = []

    for row in df.itertuples(index=False):
        original_url_value = getattr(row, "URL", None)
        try:
            url_data = schemas.BulkURLCreate(
                original_url=original_url_value,
                password=row.password if hasattr(row, "password") else None,
                count_limit=row.count_limit if hasattr(row, "count_limit") else None,
                custom_code=row.custom_code if hasattr(row, "custom_code") else None
            )

            result = create_short_url_logic(
                request=request,
                db=db,
                current_user=current_user,
                url_data=url_data
            )

            results.append(
                schemas.BulkUploadResult(
                    original_url=original_url_value,
                    short_url=result["short_url"],
                    status="success"
                )
            )
        except Exception as e:
            results.append(
                schemas.BulkUploadResult(
                    original_url=original_url_value or "",
                    short_url=None,
                    status="failed",
                    error=str(e)
                )
            )

    return results





@app.post("/api/report-abuse", response_model=schemas.ReportAbuseResponse)
@limiter.limit("2/minute")
def report_abuse(
    payload: schemas.ReportAbuseRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    url = db.query(models.URL).filter(models.URL.short_url == payload.short_url).first()
    if not url:
        raise HTTPException(status_code=404, detail="URL not found")

    existing_report = (
        db.query(models.AbuseReport)
        .filter(
            models.AbuseReport.url_id == url.id,
            models.AbuseReport.user_id == user_id
        )
        .first()
    )

    if existing_report:
        raise HTTPException(status_code=400, detail="You have already reported this URL")

    new_report = models.AbuseReport(
        url_id=url.id,
        user_id=user_id,
        reason=payload.reason
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return schemas.ReportAbuseResponse(
        message="Abuse report submitted successfully",
        abuse_id=new_report.id
    )

@app.get("/api/get-abuse", response_model=list[schemas.GetAbuseResponse])
@limiter.limit("2/minute")
def get_abuse(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    abuse_reports = (
        db.query(models.AbuseReport)
        .filter(models.AbuseReport.user_id == user_id)
        .order_by(models.AbuseReport.id)
        .all()
    )

    result = []
    for report in abuse_reports:
        result.append(
            schemas.GetAbuseResponse(
                abuse_id=report.id,
                original_url=report.url.original_url,
                short_code=report.url.short_url,
                url_id=report.url_id,
                user_id=report.user_id
            )
        )

    return result



@app.post("/api/admin/accept-abuse", response_model=schemas.AcceptAbuseResponse)
@limiter.limit("2/minute")
def accept_abuse(
    payload: schemas.AcceptAbuseRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    abuse_report = db.query(models.AbuseReport).filter(
        models.AbuseReport.id == payload.abuse_id
    ).first()

    if not abuse_report:
        raise HTTPException(status_code=404, detail="Abuse report not found")

    url = db.query(models.URL).filter(models.URL.id == abuse_report.url_id).first()
    if not url:
        raise HTTPException(status_code=404, detail="Associated URL not found")

    url.is_active = False
    db.delete(abuse_report)
    db.commit()

    return schemas.AcceptAbuseResponse(
        message="Abuse report accepted and URL disabled successfully"
    )

@app.post("/api/admin/refuse-abuse", response_model=schemas.RefuseAbuseResponse)
@limiter.limit("2/minute")
def refuse_abuse(
    payload: schemas.RefuseAbuseRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_admin)
):
    abuse_report = db.query(models.AbuseReport).filter(
        models.AbuseReport.id == payload.abuse_id
    ).first()

    if not abuse_report:
        raise HTTPException(status_code=404, detail="Abuse report not found")

    db.delete(abuse_report)
    db.commit()

    return schemas.RefuseAbuseResponse(
        message="Abuse report refused successfully"
    )