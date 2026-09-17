# 🚀 Simple Commands Guide

## Quick Start - Just 3 Commands!

### 1️⃣ Start Everything
```bash
./start.sh
```

### 2️⃣ Stop Everything
```bash
./stop.sh
```

### 3️⃣ Check Status
```bash
./status.sh
```

---

## Bonus Commands

### Restart Everything
```bash
./restart.sh
```

### View Backend Logs
```bash
tail -f backend.log
```

### View Frontend Logs
```bash
tail -f frontend.log
```

---

## ✨ That's It!

No need to remember ports, PIDs, or multiple terminals.

**Just use:**
- `./start.sh` - Start
- `./stop.sh` - Stop
- `./status.sh` - Check
- `./restart.sh` - Restart

---

## 🌐 Access the App

Once started, open your browser:
**http://localhost:5173**

---

## 📝 Notes

- All logs are saved to `backend.log` and `frontend.log`
- Scripts automatically clean up old processes
- Works on macOS (your current system)

---

## 🆘 If Something Goes Wrong

**Kill everything forcefully:**
```bash
./stop.sh
```

**Then start fresh:**
```bash
./start.sh
```

**Check what's running:**
```bash
./status.sh
```

---

## 💡 First Time Setup

Already done! ✅

If you ever need to reinstall dependencies:

**Backend:**
```bash
pip3 install -r requirements.txt
```

**Frontend:**
```bash
cd frontend && npm install
```

---

**Happy coding!** 🎉
