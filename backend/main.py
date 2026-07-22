from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

import random
import string

import models
import schemas
import security
from database import SessionLocal, engine, Base

# If database lacks the tables, creates them.

Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware( # Bu kıs
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This opens a database connection and closes it after each request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Helper: Generate a random short code ---
# e.g. "aB3xZ9"
def generate_short_code(length=6):
    characters = string.ascii_letters + string.digits
    return "".join(random.choices(characters, k=length))



# --- POST /shorten ---
# User sends a long URL, we return a short code
@app.post("/shorten", response_model=schemas.ShortenResponse)
def shorten_url(request: Request, url: schemas.URLCreate, db: Session = Depends(get_db)):


    existing_url = db.query(models.URL).filter(models.URL.original_url == str(url.original_url)).first()
    
    if existing_url:
        base_url = str(request.base_url)
        existing_short_code = str(existing_url.short_url)
        final_short_url = f"{base_url}{existing_short_code}"
        return schemas.ShortenResponse(short_url=final_short_url)
    
    else:
        short_code = generate_short_code()
        # Make sure the code is unique in database
        while db.query(models.URL).filter(models.URL.short_url == short_code).first():
            short_code = generate_short_code()
        
        base_url = str(request.base_url)

        new_url = models.URL(
            original_url=str(url.original_url),
            short_url=short_code
        )
        db.add(new_url)
        db.commit()
        db.refresh(new_url)
        final_short_url = f"{base_url}{short_code}"
        return schemas.ShortenResponse(short_url=final_short_url)



# --- GET /{short_code} ---
# User visits the short URL, we redirect them to the original
@app.get("/{short_code}")
def redirect_url(short_code: str, db: Session = Depends(get_db)):

    # Look up the short code in the DB
    url_entry = db.query(models.URL).filter(models.URL.short_url == short_code).first()

    # If not found → 404 error
    if not url_entry:
        raise HTTPException(status_code=404, detail="Short URL not found")

    # Increment the click counter
    url_entry.clicks += 1
    db.commit()

    # Redirect to the original URL
    return RedirectResponse(url=url_entry.original_url)


#This for user signup to the system. 
@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first() or db.query(models.User).filter(models.User.email == user.email).first() 
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    #hashleme burada olacak.
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
# Bu hashleme fonksiyonu kendi anahtarımızı kullanmıyor buna sonra bakalım.

@app.post("/login/", response_model=schemas.TokenResponse)
def login(user: schemas.Userlogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not security.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    token_data = {"user_id": db_user.id, "username": db_user.username}
    token = security.create_Token(token_data)
    return schemas.TokenResponse(access_token=token)


securityy = HTTPBearer() # Different compared to security.py file.

#Tokeni oluşturduktan sonra frontende at. Sonrasında bu yukardaki alanlarda kullanırken bu tokeni headera koyup yolla. 
#Requestten hem görünen body kısmını hem de gizlide kalan header kısmını al bu headerden aldığın gizlice koyduğun tokeni validatorla
#hem doğrula hem de user.id çek sonra bu url şey yaparken bunu uygula. Bundan sonra metodların değişmesi gerekebilir.