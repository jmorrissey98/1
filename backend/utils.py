"""
Utility functions for the application.
"""
import bcrypt
import re
import asyncio
import resend
from database import logger, RESEND_API_KEY, SENDER_EMAIL, APP_URL

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def validate_password(password: str) -> tuple:
    """Validate password meets requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must contain at least one letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, ""


def validate_email(email: str) -> bool:
    """Basic email format validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


async def send_email_with_retry(params: dict, email_type: str, max_retries: int = 3):
    """
    Send email with retry logic for resilience.
    """
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Sending {email_type} email to {params['to']} (attempt {attempt}/{max_retries})")
            logger.info(f"Using sender: {params['from']}, API key prefix: {resend.api_key[:10]}...")
            
            result = await asyncio.to_thread(resend.Emails.send, params)
            
            logger.info(f"Email sent successfully: {result}")
            return result
            
        except Exception as e:
            last_error = e
            error_msg = str(e)
            logger.error(f"Email attempt {attempt} failed: {error_msg}")
            
            permanent_errors = [
                "api_key",
                "unauthorized", 
                "forbidden",
                "verify",
                "domain",
                "testing emails"
            ]
            
            if any(err in error_msg.lower() for err in permanent_errors):
                logger.error(f"Permanent email error, not retrying: {error_msg}")
                raise
            
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
    
    raise last_error


async def send_password_reset_email(email: str, reset_token: str, user_name: str):
    """Send password reset email via Resend"""
    reset_link = f"{APP_URL}/reset-password?token={reset_token}"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">Reset Your Password</h2>
        <p>Hi {user_name},</p>
        <p>We received a request to reset your password for your My Coach Developer account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
            </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #64748b; word-break: break-all;">{reset_link}</p>
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request a password reset, 
            you can safely ignore this email.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "Reset Your Password - My Coach Developer",
        "html": html_content
    }
    
    return await send_email_with_retry(params, "password reset")


async def send_invite_email(email: str, inviter_name: str, role: str, invite_id: str, invitee_name: str = None):
    """Send invitation email via Resend"""
    registration_link = f"{APP_URL}/register/{invite_id}"
    role_display = "Coach Developer" if role == "coach_developer" else "Coach"
    greeting = f"Hi {invitee_name}," if invitee_name else "Hi there,"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">You're Invited to My Coach Developer</h2>
        <p>{greeting}</p>
        <p><strong>{inviter_name}</strong> has invited you to join My Coach Developer as a <strong>{role_display}</strong>.</p>
        <p>My Coach Developer is a coaching observation app that helps track and analyze coaching sessions.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{registration_link}" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Complete Your Registration
            </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #64748b; word-break: break-all;">{registration_link}</p>
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This invitation link is unique to you and can only be used once.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "You're invited to My Coach Developer",
        "html": html_content
    }
    
    return await send_email_with_retry(params, "invite")
