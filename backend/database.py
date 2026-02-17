"""
Database connection and shared state for the application.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
import os
import logging
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Email configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL')
APP_URL = os.environ.get('APP_URL')

# Default session parts
DEFAULT_SESSION_PARTS = [
    {"part_id": "default_technique", "name": "Develop The Technique", "is_default": True},
    {"part_id": "default_game_model", "name": "Develop The Game Model", "is_default": True},
    {"part_id": "default_performance", "name": "Develop Performance", "is_default": True},
    {"part_id": "default_mentality", "name": "Develop Mentality", "is_default": True},
]
