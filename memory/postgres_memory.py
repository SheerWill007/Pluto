# import psycopg2
# from config.settings import settings
#
#
# def get_connection():
#     return psycopg2.connect(
#         host=settings.POSTGRES_HOST,
#         port=settings.POSTGRES_PORT,
#         dbname=settings.POSTGRES_DB,
#         user=settings.POSTGRES_USER,
#         password=settings.POSTGRES_PASSWORD
#     )
#
#
# def save_fact(session_id: str, fact: str, user_id: str = None):
#     user_id = user_id or session_id
#     conn = get_connection()
#     cur = conn.cursor()
#
#     cur.execute(
#         "INSERT INTO facts (user_id, session_id, fact) VALUES (%s, %s, %s)",
#         (user_id, session_id, fact)
#     )
#
#     conn.commit()
#     cur.close()
#     conn.close()
#
#
# def get_facts(session_id: str, user_id: str = None) -> list:
#     user_id = user_id or session_id
#     conn = get_connection()
#     cur = conn.cursor()
#
#     cur.execute(
#         "SELECT fact FROM facts WHERE user_id = %s ORDER BY created_at",
#         (user_id,)
#     )
#
#     rows = cur.fetchall()
#     cur.close()
#     conn.close()
#
#     return [row[0] for row in rows]
#
#
# def clear_facts(session_id: str, user_id: str = None):
#     user_id = user_id or session_id
#     conn = get_connection()
#     cur = conn.cursor()
#
#     cur.execute("DELETE FROM facts WHERE user_id = %s", (user_id,))
#
#     conn.commit()
#     cur.close()
#     conn.close()

import psycopg2
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

# Flag to track if PostgreSQL is available
_postgres_available = None

def check_postgres_availability():
    """Check if PostgreSQL is available and cache the result"""
    global _postgres_available
    if _postgres_available is not None:
        return _postgres_available
    
    try:
        conn = psycopg2.connect(
            host = settings.POSTGRES_HOST,
            port = settings.POSTGRES_PORT,
            dbname = settings.POSTGRES_DB,
            user = settings.POSTGRES_USER,
            password = settings.POSTGRES_PASSWORD,
            connect_timeout=3
        )
        conn.close()
        _postgres_available = True
        logger.info("PostgreSQL connection successful")
        return True
    except Exception as e:
        _postgres_available = False
        logger.warning(f"PostgreSQL not available: {e}")
        return False

def get_connection():
    if not check_postgres_availability():
        raise Exception("PostgreSQL is not available")
    return psycopg2.connect(
        host = settings.POSTGRES_HOST,
        port = settings.POSTGRES_PORT,
        dbname = settings.POSTGRES_DB,
        user = settings.POSTGRES_USER,
        password = settings.POSTGRES_PASSWORD
    )

def save_fact(session_id: str , fact:str , user_id : str = None):
    if not check_postgres_availability():
        logger.warning("PostgreSQL not available, skipping save_fact")
        return
    try:
        user_id = user_id or session_id
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO facts(user_id , session_id , fact) VALUES (%s,%s, %s)",
            (user_id , session_id , fact)
        )

        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error saving fact: {e}")

def get_facts(session_id : str , user_id : str = None) -> list :
    if not check_postgres_availability():
        logger.warning("PostgreSQL not available, returning empty facts list")
        return []
    try:
        user_id = user_id or session_id
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT fact FROM facts where user_id = %s ORDER BY created_at",
            (user_id,)
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()
        return [row[0] for row in rows]
    except Exception as e:
        logger.error(f"Error getting facts: {e}")
        return []

def clear_facts(session_id: str , user_id : str = None):
    if not check_postgres_availability():
        logger.warning("PostgreSQL not available, skipping clear_facts")
        return
    try:
        user_id = user_id or session_id
        conn = get_connection()
        cur = conn. cursor()

        cur.execute(
            "DELETE FROM facts WHERE user_id = %s ",(user_id,)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error clearing facts: {e}")

def init_user_table():
    if not check_postgres_availability():
        logger.warning("PostgreSQL not available, skipping table initialization")
        return
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                name VARCHAR(255),
                picture TEXT,
                auth_provider VARCHAR(50) DEFAULT 'local',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Ensure facts table is initialized
        cur.execute("""
            CREATE TABLE IF NOT EXISTS facts (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                session_id VARCHAR(255) NOT NULL,
                fact TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
        logger.info("Postgres tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing Postgres user/facts tables: {e}")

def init_gmail_tokens_table():
    if not check_postgres_availability():
        logger.warning("PostgreSQL not available, skipping gmail_tokens table initialization")
        return
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS gmail_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_expiry TIMESTAMP,
                connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
        logger.info("Postgres gmail_tokens table initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing Postgres gmail_tokens table: {e}")

def create_local_user(email: str, password_hash: str, name: str) -> dict:
    if not check_postgres_availability():
        raise Exception("PostgreSQL not available - cannot create user")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (email, password_hash, name, auth_provider) VALUES (%s, %s, %s, 'local') RETURNING id, email, name, picture, auth_provider",
        (email, password_hash, name)
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return {
        "id": row[0],
        "email": row[1],
        "name": row[2],
        "picture": row[3],
        "auth_provider": row[4]
    }

def get_user_by_email(email: str) -> dict:
    if not check_postgres_availability():
        return None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, password_hash, name, picture, auth_provider FROM users WHERE email = %s",
            (email,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return None
        return {
            "id": row[0],
            "email": row[1],
            "password_hash": row[2],
            "name": row[3],
            "picture": row[4],
            "auth_provider": row[5]
        }
    except Exception as e:
        logger.error(f"Error getting user by email: {e}")
        return None

def get_or_create_google_user(email: str, name: str, picture: str) -> dict:
    if not check_postgres_availability():
        raise Exception("PostgreSQL not available - cannot manage Google user")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, email, name, picture, auth_provider FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE users SET name = %s, picture = %s WHERE email = %s RETURNING id, email, name, picture, auth_provider",
            (name, picture, email)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {
            "id": row[0],
            "email": row[1],
            "name": row[2],
            "picture": row[3],
            "auth_provider": row[4]
        }
    else:
        cur.execute(
            "INSERT INTO users (email, name, picture, auth_provider) VALUES (%s, %s, %s, 'google') RETURNING id, email, name, picture, auth_provider",
            (email, name, picture)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {
            "id": row[0],
            "email": row[1],
            "name": row[2],
            "picture": row[3],
            "auth_provider": row[4]
        }


def save_gmail_token(user_id, access_token, refresh_token, token_expiry):
    if not check_postgres_availability():
        raise Exception("PostgreSQL not available - cannot save Gmail token")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO gmail_tokens (user_id, access_token, refresh_token, token_expiry, connected_at)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, gmail_tokens.refresh_token),
            token_expiry = EXCLUDED.token_expiry,
            connected_at = CURRENT_TIMESTAMP
        RETURNING id, user_id, access_token, refresh_token, token_expiry, connected_at;
    """, (user_id, access_token, refresh_token, token_expiry))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return {
        "id": row[0],
        "user_id": row[1],
        "access_token": row[2],
        "refresh_token": row[3],
        "token_expiry": row[4],
        "connected_at": row[5]
    }


def get_gmail_token(user_id):
    if not check_postgres_availability():
        return None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT access_token, refresh_token, token_expiry FROM gmail_tokens WHERE user_id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return None
        return {
            "access_token": row[0],
            "refresh_token": row[1],
            "token_expiry": row[2]
        }
    except Exception as e:
        logger.error(f"Error getting Gmail token for user {user_id}: {e}")
        return None


def delete_gmail_token(user_id):
    if not check_postgres_availability():
        logger.warning("PostgreSQL not available, skipping delete_gmail_token")
        return False
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM gmail_tokens WHERE user_id = %s", (user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error deleting Gmail token for user {user_id}: {e}")
        return False