#sets up the connection to the database and creates the tables if they don't exist.
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import redis

DATABASE_URL = "postgresql://user:112131@db:5432/deneme"
engine = create_engine(DATABASE_URL) # Gives the engine the database URL to connect to the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) # Opens and closes the database
Base = declarative_base() #All our tables will inherit from this.

'''This line looks at ALL classes that inherit from Base and creates their tables in the database if they don't exist yet
Base.metadata.create_all(bind=engine) Claude recommended to use incase save the data etc. As of now i dont use it.'''

redis_client = redis.Redis(host="redis", port=6379, db=0, decode_responses=True) # This is for caching at phase 4.
