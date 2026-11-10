import os
import sys
import datetime
from typing import Optional, List
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .database import get_db
from .models import User, Courier

# Load .env if present
load_dotenv()

ph = PasswordHasher()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security_bearer = HTTPBearer(auto_error=False)

def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if secret and secret.strip():
        return secret.strip()
    
    # Strictly require explicit TESTING=1 environment variable for isolated testing
    if os.getenv("TESTING") == "1":
        return "coyote_test_isolated_secret_key_non_production_32bytes_len"
    
    raise RuntimeError(
        "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET_KEY environment variable is missing or empty. "
        "You must configure a strong JWT_SECRET_KEY in your environment or .env file before running Coyote Delivery."
    )

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError, TypeError):
        return False

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    secret = get_jwt_secret()
    to_encode = data.copy()
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({
        "exp": expire,
        "iat": now_utc,
    })
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    secret = get_jwt_secret()
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub"]}
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Returns authenticated user if a valid Bearer token is provided.
    If no header is sent, returns None for anonymous access.
    IMPORTANT: If a token IS provided, but is expired, malformed, or references an inactive user,
    it raises 401 instead of silently degrading to anonymous access.
    """
    if not auth or not auth.credentials:
        return None

    payload = decode_token(auth.credentials)
    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject identity.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(user_id_raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: invalid subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator.",
        )
    return user

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """
    Strict authentication dependency. Requires a valid, active Bearer token.
    """
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a Bearer token in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(auth.credentials)
    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject identity.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(user_id_raw)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: invalid subject identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated.",
        )
    return user

def require_roles(*roles: str):
    """
    Role-based access control dependency factory.
    Verifies the user's role against live database state.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of [{', '.join(roles)}] role, but you are '{current_user.role}'.",
            )
        return current_user
    return role_checker
