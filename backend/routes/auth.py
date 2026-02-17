"""
Authentication routes - login, signup, password reset, session management.
"""
from fastapi import APIRouter, HTTPException, Request, Response
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import httpx

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from models import (
    UserResponse, SignupRequest, LoginRequest, 
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
)
from dependencies import require_auth, get_current_user
from utils import (
    hash_password, verify_password, validate_password, 
    validate_email, send_password_reset_email
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id from Emergent Auth for session_token"""
    try:
        body = await request.json()
        session_id = body.get("session_id")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        
        logger.info(f"Auth session exchange started for session_id: {session_id[:20]}...")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            logger.info(f"Emergent auth response status: {auth_response.status_code}")
            
            if auth_response.status_code != 200:
                logger.error(f"Emergent auth failed: {auth_response.text}")
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = auth_response.json()
        
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        logger.info(f"Auth data received for email: {email}")
        
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        logger.info(f"Existing user lookup result: {bool(existing_user)}")
        
        if existing_user:
            logger.info(f"Updating existing user: {existing_user.get('user_id')}")
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
            user_role = existing_user.get("role", "coach")
            linked_coach_id = existing_user.get("linked_coach_id")
        else:
            invite = await db.invites.find_one({"email": email, "used": False}, {"_id": 0})
            user_count = await db.users.count_documents({})
            
            if user_count == 0:
                user_role = "coach_developer"
                linked_coach_id = None
            elif invite:
                user_role = invite.get("role", "coach")
                linked_coach_id = invite.get("coach_id")
                invited_by = invite.get("invited_by")
                
                await db.invites.update_one(
                    {"invite_id": invite["invite_id"]},
                    {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                if user_role == "coach":
                    existing_coach = await db.coaches.find_one(
                        {"email": {"$regex": f"^{email}$", "$options": "i"}},
                        {"_id": 0}
                    )
                    
                    if existing_coach:
                        linked_coach_id = existing_coach.get("id")
                        logger.info(f"Linking user {email} to existing coach profile {linked_coach_id}")
                    else:
                        coach_id = f"coach_{uuid.uuid4().hex[:12]}"
                        new_coach = {
                            "id": coach_id,
                            "user_id": None,
                            "name": name,
                            "email": email,
                            "photo": picture,
                            "role_title": None,
                            "age_group": None,
                            "department": None,
                            "bio": None,
                            "targets": [],
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "created_by": invited_by
                        }
                        await db.coaches.insert_one(new_coach)
                        linked_coach_id = coach_id
                        logger.info(f"Auto-created coach profile {coach_id} for invited user {email}")
            else:
                raise HTTPException(
                    status_code=403, 
                    detail="Registration requires an invite. Please contact a Coach Developer."
                )
            
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": user_role,
                "linked_coach_id": linked_coach_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "auth_provider": "google"
            }
            await db.users.insert_one(new_user)
            
            if user_role == "coach" and linked_coach_id:
                await db.coaches.update_one(
                    {"id": linked_coach_id},
                    {"$set": {
                        "user_id": user_id,
                        "photo": picture,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": user_role,
            "linked_coach_id": linked_coach_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Auth error: {str(e)}\nTraceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(request: Request):
    """Get current authenticated user"""
    user = await require_auth(request)
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    auth_provider = user_doc.get("auth_provider", "google") if user_doc else "google"
    organization_id = user_doc.get("organization_id") if user_doc else user.organization_id
    
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
        linked_coach_id=user.linked_coach_id,
        organization_id=organization_id,
        auth_provider=auth_provider
    )


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout - clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"status": "logged out"}


@router.post("/signup")
async def signup(signup_data: SignupRequest, response: Response):
    """Create a new account with email and password"""
    try:
        if not validate_email(signup_data.email):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        is_valid, error_msg = validate_password(signup_data.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        email_lower = signup_data.email.lower()
        
        existing_user = await db.users.find_one(
            {"email": {"$regex": f"^{email_lower}$", "$options": "i"}}, 
            {"_id": 0}
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        
        user_count = await db.users.count_documents({})
        
        if user_count == 0:
            user_role = "coach_developer"
            linked_coach_id = None
        else:
            invite = await db.invites.find_one(
                {"email": {"$regex": f"^{email_lower}$", "$options": "i"}, "used": False}, 
                {"_id": 0}
            )
            
            if invite:
                user_role = invite.get("role", "coach")
                linked_coach_id = invite.get("coach_id")
                await db.invites.update_one(
                    {"invite_id": invite["invite_id"]},
                    {"$set": {"used": True}}
                )
            else:
                raise HTTPException(
                    status_code=403, 
                    detail="Registration requires an invite. Please contact a Coach Developer."
                )
        
        password_hash = hash_password(signup_data.password)
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        session_token = secrets.token_urlsafe(32)
        
        new_user = {
            "user_id": user_id,
            "email": signup_data.email,
            "name": signup_data.name,
            "password_hash": password_hash,
            "picture": None,
            "role": user_role,
            "linked_coach_id": linked_coach_id,
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        
        if user_role == "coach_developer" and (signup_data.club_name or signup_data.club_logo):
            org_id = f"org_{uuid.uuid4().hex[:12]}"
            org_doc = {
                "org_id": org_id,
                "owner_id": user_id,
                "club_name": signup_data.club_name,
                "club_logo": signup_data.club_logo,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.organizations.insert_one(org_doc)
            logger.info(f"Created organization {org_id} for user {user_id}")
        
        if user_role == "coach" and linked_coach_id:
            await db.coaches.update_one(
                {"id": linked_coach_id},
                {"$set": {
                    "user_id": user_id,
                    "has_account": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Linked user {user_id} to coach profile {linked_coach_id}")
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": signup_data.email,
            "name": signup_data.name,
            "role": user_role,
            "linked_coach_id": linked_coach_id,
            "auth_provider": "email",
            "token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")


@router.post("/login")
async def login(login_data: LoginRequest, response: Response):
    """Login with email and password"""
    try:
        user_doc = await db.users.find_one({"email": login_data.email}, {"_id": 0})
        
        if not user_doc:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        password_hash = user_doc.get("password_hash")
        if not password_hash:
            raise HTTPException(
                status_code=401, 
                detail="This account uses Google sign-in. Please use 'Sign in with Google'."
            )
        
        if not verify_password(login_data.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        user_id = user_doc["user_id"]
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": user_doc["email"],
            "name": user_doc["name"],
            "picture": user_doc.get("picture"),
            "role": user_doc.get("role", "coach"),
            "linked_coach_id": user_doc.get("linked_coach_id"),
            "auth_provider": user_doc.get("auth_provider", "email"),
            "token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@router.post("/forgot-password")
async def forgot_password(forgot_data: ForgotPasswordRequest):
    """Request password reset email"""
    try:
        user_doc = await db.users.find_one({"email": forgot_data.email}, {"_id": 0})
        
        if not user_doc:
            return {"message": "If an account with this email exists, a password reset link has been sent."}
        
        if user_doc.get("auth_provider") == "google" and not user_doc.get("password_hash"):
            return {"message": "If an account with this email exists, a password reset link has been sent."}
        
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        await db.password_resets.delete_many({"email": forgot_data.email})
        await db.password_resets.insert_one({
            "email": forgot_data.email,
            "token": reset_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        try:
            await send_password_reset_email(
                email=forgot_data.email,
                reset_token=reset_token,
                user_name=user_doc.get("name", "User")
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
        
        return {"message": "If an account with this email exists, a password reset link has been sent."}
        
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        return {"message": "If an account with this email exists, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(reset_data: ResetPasswordRequest):
    """Reset password using token"""
    try:
        reset_doc = await db.password_resets.find_one({"token": reset_data.token}, {"_id": 0})
        
        if not reset_doc:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
        expires_at = datetime.fromisoformat(reset_doc["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await db.password_resets.delete_one({"token": reset_data.token})
            raise HTTPException(status_code=400, detail="Reset token has expired")
        
        is_valid, error_msg = validate_password(reset_data.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        password_hash = hash_password(reset_data.new_password)
        
        result = await db.users.update_one(
            {"email": reset_doc["email"]},
            {"$set": {"password_hash": password_hash, "auth_provider": "email"}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=400, detail="User not found")
        
        await db.password_resets.delete_one({"token": reset_data.token})
        
        user_doc = await db.users.find_one({"email": reset_doc["email"]}, {"_id": 0})
        if user_doc:
            await db.user_sessions.delete_many({"user_id": user_doc["user_id"]})
        
        return {"message": "Password has been reset successfully. Please log in with your new password."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reset password")


@router.post("/change-password")
async def change_password(change_data: ChangePasswordRequest, request: Request):
    """Change password for authenticated user"""
    user = await require_auth(request)
    
    try:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        password_hash = user_doc.get("password_hash")
        if not password_hash:
            raise HTTPException(
                status_code=400, 
                detail="Cannot change password for Google-only accounts"
            )
        
        if not verify_password(change_data.current_password, password_hash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        is_valid, error_msg = validate_password(change_data.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        new_password_hash = hash_password(change_data.new_password)
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"password_hash": new_password_hash}}
        )
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to change password")


@router.get("/verify-reset-token/{token}")
async def verify_reset_token(token: str):
    """Verify if a password reset token is valid"""
    try:
        reset_doc = await db.password_resets.find_one({"token": token}, {"_id": 0})
        
        if not reset_doc:
            return {"valid": False, "message": "Invalid reset token"}
        
        expires_at = datetime.fromisoformat(reset_doc["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            return {"valid": False, "message": "Reset token has expired"}
        
        return {"valid": True, "email": reset_doc["email"]}
        
    except Exception as e:
        logger.error(f"Verify reset token error: {str(e)}")
        return {"valid": False, "message": "Failed to verify token"}


@router.post("/register-invite")
async def register_with_invite(request: Request, response: Response):
    """Register a new user via invite link"""
    try:
        body = await request.json()
        invite_id = body.get("invite_id")
        password = body.get("password")
        name = body.get("name")
        marketing_opt_in = body.get("marketing_opt_in", False)
        
        if not invite_id or not password or not name:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Validate password
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Find and validate invite
        invite = await db.invites.find_one({"invite_id": invite_id}, {"_id": 0})
        
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid invite link")
        
        if invite.get("used"):
            raise HTTPException(status_code=400, detail="This invite has already been used")
        
        email = invite["email"]
        role = invite.get("role", "coach")
        coach_id = invite.get("coach_id")
        invited_by = invite.get("invited_by")
        
        # Check if user already exists
        existing_user = await db.users.find_one(
            {"email": {"$regex": f"^{email}$", "$options": "i"}},
            {"_id": 0}
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        
        # Get inviter's organization
        inviter = await db.users.find_one({"user_id": invited_by}, {"_id": 0})
        organization_id = None
        if inviter:
            if inviter.get("role") == "admin":
                pass
            elif inviter.get("organization_id"):
                organization_id = inviter["organization_id"]
            else:
                org = await db.organizations.find_one({"owner_id": invited_by}, {"_id": 0})
                if org:
                    organization_id = org["org_id"]
        
        # Hash password
        password_hash = hash_password(password)
        
        # Create user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        session_token = secrets.token_urlsafe(32)
        
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "password_hash": password_hash,
            "picture": None,
            "role": role,
            "linked_coach_id": coach_id,
            "organization_id": organization_id,
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "marketing_opt_in": marketing_opt_in,
            "marketing_opt_in_at": datetime.now(timezone.utc).isoformat() if marketing_opt_in else None
        }
        await db.users.insert_one(new_user)
        
        # Mark invite as used
        await db.invites.update_one(
            {"invite_id": invite_id},
            {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update coach profile if exists
        if coach_id:
            await db.coaches.update_one(
                {"id": coach_id},
                {"$set": {
                    "user_id": user_id,
                    "name": name,
                    "has_account": True,
                    "organization_id": organization_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Linked user {user_id} to coach profile {coach_id}")
        
        # Create session
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": email,
            "name": name,
            "role": role,
            "linked_coach_id": coach_id,
            "organization_id": organization_id,
            "auth_provider": "email",
            "token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register invite error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")
