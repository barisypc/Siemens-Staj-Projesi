from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# Association table for the many-to-many relationship between URLs and Tags.
# A URL can have many tags, and a tag can be applied to many of that user's URLs.
url_tags = Table(
    "url_tags",
    Base.metadata,
    Column("url_id", Integer, ForeignKey("urls.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


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
    tags = relationship("Tag", secondary=url_tags, back_populates="urls")
    reports = relationship("AbuseReport", back_populates="url", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

    urls =    relationship("URL", back_populates="owner", cascade="all, delete-orphan")
    tags =    relationship("Tag", back_populates="owner", cascade="all, delete-orphan")
    reports = relationship("AbuseReport", back_populates="owner", cascade="all, delete-orphan" )


class URLClick(Base):
    __tablename__ = "url_clicks"

    id = Column(Integer, primary_key=True, index=True)
    url_id = Column(Integer, ForeignKey("urls.id", ondelete="CASCADE"), nullable=False)
    clicked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accessed_platform = Column(String, nullable=True)
    accessed_browser = Column(String, nullable=True)
    accessed_country = Column(String, nullable=True)

    url = relationship("URL", back_populates="click_logs")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    owner = relationship("User", back_populates="tags")
    urls = relationship("URL", secondary=url_tags, back_populates="tags")

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_tag_name"),)


#Burayı düzenleyelim. cumaya kadar bitirirsek geriye hata düzeltme vs. kalır.
class AbuseReport(Base):
    __tablename__ = "abuse_reports"

    id =      Column(Integer, primary_key=True, index=True)
    url_id =  Column(Integer, ForeignKey("urls.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    url   = relationship("URL", back_populates="reports")
    owner = relationship("User", back_populates="reports")



