import os


def get_supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "")


def get_supabase_anon_key() -> str:
    return os.getenv("SUPABASE_ANON_KEY", "")


def get_supabase_service_role_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_admin_secret() -> str:
    return os.getenv("ADMIN_SECRET", "changeme-admin-secret")

