# 🚨 Database Setup Required

## Issue
The backend server cannot start because PostgreSQL is not configured.

## Quick Setup Options

### Option 1: Docker (Recommended - Easiest)

Run this command to start PostgreSQL in Docker:

```bash
docker run --name school-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=school_management -p 5432:5432 -d postgres
```

Then update your `.env` file:
```env
DATABASE_URL="postgresql://postgres:arwa@localhost:5432/inja?schema=public"
```

### Option 2: Local PostgreSQL Installation

1. **Install PostgreSQL** from https://www.postgresql.org/download/windows/

2. **Create Database**:
   ```sql
   CREATE DATABASE inja;
   ```

3. **Update `.env` file** with your credentials:
   ```env
   DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/school_management?schema=public"
   ```

## After Database Setup

1. **Run Prisma migrations**:
   ```bash
   cd arwa
   npm run prisma:migrate
   ```

2. **Start backend**:
   ```bash
   npm run dev
   ```

3. **In another terminal, start frontend**:
   ```bash
   cd arwa/frontend
   npm run dev
   ```

4. **Visit the app**:
   - Frontend: http://localhost:3001
   - First-time setup: http://localhost:3001/register-admin

## Current Status

✅ Backend code complete (40+ files)  
✅ Frontend code complete (50+ files)  
✅ .env files created  
⏳ **Need PostgreSQL database**  
⏳ Need to run migrations  

## Next Steps

1. Choose Option 1 (Docker) or Option 2 (Local PostgreSQL)
2. Run the database setup commands
3. Run `npm run prisma:migrate` in the backend directory
4. Start both servers
5. Create your admin account!
