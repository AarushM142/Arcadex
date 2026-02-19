import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# These variables come from your backend/.env file
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Create a single instance of the Supabase client
# Use this throughout your app to perform DB operations
# We use the service role key so the backend can bypass RLS for administrative actions
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)