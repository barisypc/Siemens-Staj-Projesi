from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class URL(Base):
    __tablename__ = "urls"

    id = Column(Integer, primary_key=True, index=True)
    original_url = Column(String, unique=False, index=True)
    short_url = Column(String, unique=True, index=True)
    clicks = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))

    expires_at = Column(DateTime, nullable=True)
    click_limit = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="urls")
    click_logs = relationship("URLClick", back_populates="url", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

    urls = relationship("URL", back_populates="owner", cascade="all, delete-orphan")

class URLClick(Base):
    __tablename__ = "url_clicks"

    id = Column(Integer, primary_key=True, index=True)
    url_id = Column(Integer, ForeignKey("urls.id", ondelete="CASCADE"), nullable=False)
    clicked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accessed_platform = Column(String, nullable=True)
    accessed_browser = Column(String, nullable=True)
    accessed_country = Column(String, nullable=True)

    url = relationship("URL", back_populates="click_logs")