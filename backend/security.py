from datetime import datetime, timedelta
import hashlib
import jwt

#This part does 4 key things:

def hash_password(password: str) -> str:
    #salt pepper mantığını implemente edicez.
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    return hashed_password

def verify_password(plain_password, hashed_password):
    return hash_password(plain_password) == hashed_password


def create_Token(data):
    key = "dunyaninengizlianahtari"
    exp = datetime.utcnow() + timedelta(seconds = 300)
    payload = {**data, "exp": exp} 
    created_token = jwt.encode(payload, key, algorithm="HS256")
    return created_token


def verify_Token(token):
    key = "dunyaninengizlianahtari"
    try:
        verified_token = jwt.decode(token, key, algorithm="HS256")
        return verified_token
    except jwt.ExpiredSignatureError:
        print("Expired session. Please log in again!")
    except jwt.InvalidTokenError:
        print("Invalid token. Please log in again!")

