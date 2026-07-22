from pydantic import BaseModel, HttpUrl

# This is the schema for the URL model. It defines the structure of the data that will be used in the application. The URLCreate class inherits from BaseModel and has a single attribute long_url, which is of type HttpUrl. This ensures that any data passed to this model will be validated as a proper URL.
# This py file only does the talk between user, database, functions etc. Its like a middleman. 
class URLCreate(BaseModel):
    original_url: HttpUrl

class ShortenResponse(BaseModel):
    short_url: str

class URLResponse(BaseModel):
    id: int
    original_url: HttpUrl
    short_url: str
    clicks: int

    class Config:
        orm_mode = True

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class Userlogin(BaseModel):
    email: str
    password: str
    username: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        orm_mode = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: int
    username: str
