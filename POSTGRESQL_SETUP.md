# PostgreSQL Setup (Optional)

## Status
✅ **The application is now running without PostgreSQL!**

PostgreSQL is **optional** and only needed for:
- User authentication (login/signup)
- Persistent fact storage across sessions
- User profile management

The core AI agent features work without PostgreSQL.

---

## If You Want to Enable PostgreSQL

### Option 1: Install PostgreSQL Locally (macOS)

#### 1. Install PostgreSQL using Homebrew
```bash
brew install postgresql@14
```

#### 2. Start PostgreSQL service
```bash
brew services start postgresql@14
```

#### 3. Create the database and user
```bash
# Create the postgres role
createuser -s postgres

# Set password for postgres user
psql postgres
# Then in psql:
ALTER USER postgres WITH PASSWORD 'password';
\q
```

#### 4. Create the application database
```bash
createdb -U postgres agent_db
```

#### 5. Verify connection
```bash
psql -U postgres -d agent_db -h localhost
```

#### 6. Restart the application
The backend will automatically detect PostgreSQL and initialize the tables.

---

### Option 2: Use Docker PostgreSQL

#### 1. Start PostgreSQL with Docker
```bash
docker run -d \
  --name postgres-agent \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=agent_db \
  -p 5432:5432 \
  postgres:14
```

#### 2. Verify it's running
```bash
docker ps | grep postgres
```

#### 3. Restart the application
The backend will automatically connect to PostgreSQL.

---

### Option 3: Disable PostgreSQL Features (Current Setup)

If you don't need authentication features, the app works perfectly as-is!

The application will:
- ✅ Chat with AI agents
- ✅ Generate code
- ✅ Research topics
- ✅ Use RAG (document upload & search)
- ✅ Email integration
- ⚠️ No user authentication
- ⚠️ No persistent facts storage

---

## Environment Variables

Your current `.env` file has these PostgreSQL settings:

```bash
POSTGRES_URL=postgresql://postgres:password@localhost:5432/agent_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=agent_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
```

These are fine. Once PostgreSQL is installed, the app will automatically use it.

---

## Verification

### Check if PostgreSQL is Running
```bash
# Try to connect
psql -U postgres -h localhost -d agent_db

# Or check the process
ps aux | grep postgres
```

### Check Application Logs
When PostgreSQL is available, you'll see:
```
PostgreSQL connection successful
Postgres tables initialized successfully.
```

When PostgreSQL is not available (current state):
```
PostgreSQL not available, skipping table initialization
```

Both are fine! The app works either way.

---

## Troubleshooting

### "role postgres does not exist"
```bash
createuser -s postgres
psql postgres -c "ALTER USER postgres WITH PASSWORD 'password';"
```

### "database agent_db does not exist"
```bash
createdb -U postgres agent_db
```

### Port 5432 already in use
```bash
# Find what's using the port
lsof -i :5432

# Stop existing PostgreSQL
brew services stop postgresql@14
# Or for different versions:
brew services list
```

### Connection refused
```bash
# Check if PostgreSQL is running
brew services list | grep postgres

# Start it if not running
brew services start postgresql@14
```

---

## Summary

**Current Status:** ✅ Application is working without PostgreSQL

**To Enable PostgreSQL:**
1. Install: `brew install postgresql@14`
2. Start: `brew services start postgresql@14`
3. Create role: `createuser -s postgres`
4. Create DB: `createdb -U postgres agent_db`
5. Set password: `psql postgres -c "ALTER USER postgres WITH PASSWORD 'password';"`
6. Restart app (it will auto-detect)

**Don't Need It?** No problem! Keep using the app as-is. 🚀
