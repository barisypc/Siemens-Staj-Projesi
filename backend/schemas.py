from pydantic import BaseModel, HttpUrl, EmailStr
from typing import Optional, List
from datetime import datetime

class URLCreate(BaseModel):
    original_url: HttpUrl
    custom_code: Optional[str] = None
    qr_code: Optional[bool] = False
    expiration_minutes: Optional[int] = None
    count_limit: Optional[int] = None
    password: Optional[str] = None

class ShortenResponse(BaseModel):
    short_url: str
    qr_code_image: Optional[str] = None

class TagCreate(BaseModel):
    name: str

class TagUpdateRequest(BaseModel):
    name: Optional[str] = None

class TagResponse(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True
        from_attributes = True

class URLTagsUpdateRequest(BaseModel):
    tag_ids: List[int]

class URLResponse(BaseModel):
    id: int
    original_url: str
    short_url: str
    clicks: int
    is_active: bool
    expires_at: Optional[datetime] = None
    click_limit: Optional[int] = None
    tags: List[TagResponse] = []

    class Config:
        orm_mode = True
        from_attributes = True

class URLValidationUpdate(BaseModel):
    is_active: bool

class URLAccessRequest(BaseModel):
    password: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class Userlogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        orm_mode = True
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: int
    username: str

#This structure allows data to be usable in many scenarios.
class StatItem(BaseModel):
    label: str
    count: int

class RecentClickItem(BaseModel):
    timestamp: str
    count: int

class URLStatisticsResponse(BaseModel):
    url_id: int
    short_url: str
    original_url: str
    total_clicks: int
    by_platform: List[StatItem]
    by_browser: List[StatItem]
    by_country: List[StatItem]
    recent_clicks: List[RecentClickItem]


class URLPasswordRequest(BaseModel):
    password: str

class URLAccessResponse(BaseModel):
    message: str
    original_url: str


class UserDelete(BaseModel):
    user_id: int


class AdminMessageResponse(BaseModel):
    message: str

class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    banned_users: int
    total_urls: int
    active_urls: int
    inactive_urls: int
    protected_urls: int
    total_clicks: int

class AdminUserListItem(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_active: bool
    is_admin: bool
    url_count: int
    total_clicks: int

    class Config:
        orm_mode = True
        from_attributes = True

class AdminUserBanRequest(BaseModel):
    is_active: bool

class AdminUserURLItem(BaseModel):
    id: int
    original_url: str
    short_url: str
    clicks: int
    is_active: bool
    expires_at: Optional[datetime] = None
    click_limit: Optional[int] = None

    class Config:
        orm_mode = True
        from_attributes = True

class CurrentUserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool

    class Config:
        orm_mode = True
        from_attributes = True

class ChangePasswordRequest(BaseModel):
    email: str
    current_password: str
    new_password: str