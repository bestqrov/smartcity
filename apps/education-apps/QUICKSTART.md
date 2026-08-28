# 🚀 Quick Start Guide - Smart School Management System

## ✅ What's Already Done

- ✅ All backend files created (40+ files)
- ✅ Dependencies installed
- ✅ Prisma client generated
- ✅ TypeScript configured

## 📋 Next Steps to Run the Backend

### Step 1: Setup PostgreSQL Database

You need a PostgreSQL database. Choose one option:

**Option A: Local PostgreSQL**
- Install PostgreSQL on your machine
- Create a database named `school_management`

**Option B: Docker (Recommended)**
```bash
docker run --name school-postgres -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=school_management -p 5432:5432 -d postgres
```

### Step 2: Configure Environment

Update the `.env.example` file and save it as `.env`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/school_management?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=change-this-to-a-secure-random-string
JWT_EXPIRES_IN=7d
```

**Important**: Replace `username` and `password` with your actual PostgreSQL credentials.

### Step 3: Run Database Migrations

```bash
npm run prisma:migrate
```

This will create all tables in your database.

### Step 4: Create Admin User

Open Prisma Studio:
```bash
npm run prisma:studio
```

Then:
1. Navigate to the `User` model
2. Click "Add record"
3. Fill in:
   - **email**: `admin@school.com`
   - **password**: Use bcrypt to hash your password first
   - **name**: `Admin User`
   - **role**: `ADMIN`
4. Click "Save 1 change"

**To hash a password**, you can use this Node.js command:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('yourpassword', 10).then(console.log)"
```

### Step 5: Start the Server

```bash
npm run dev
```

You should see:
```
✅ Database connected successfully
🚀 Server is running on port 3000
📍 Environment: development
🔗 Health check: http://localhost:3000/health
```

### Step 6: Test the API

**Test Health Check:**
```bash
curl http://localhost:3000/health
```

**Test Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"yourpassword"}'
```

You should receive a JWT token in the response.

**Test Protected Endpoint:**
```bash
# Replace YOUR_TOKEN with the token from login
curl http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio (database GUI)
```

---

## 📚 API Endpoints Summary

### Public
- `POST /auth/login` - Login to get JWT token

### Admin Only
- `/users` - User management (CRUD)
- `/payments` - Payment records
- `/attendance` - Attendance tracking
- `/settings` - School settings

### Admin + Secretary
- `/students` - Student management (CRUD)
- `/inscriptions` - Inscription management (CRUD)

---

## 🔑 Testing with Different Roles

### Create a Secretary User

After logging in as admin, create a secretary:

```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "secretary@school.com",
    "password": "secretarypass",
    "name": "Secretary User",
    "role": "SECRETARY"
  }'
```

Then test secretary access:
- ✅ Can access `/students` and `/inscriptions`
- ❌ Cannot access `/users`, `/payments`, `/attendance`, `/settings`

---

## 🐛 Troubleshooting

### Database Connection Error
- Check PostgreSQL is running
- Verify DATABASE_URL in `.env` is correct
- Ensure database `school_management` exists

### "Prisma Client not generated"
```bash
npm run prisma:generate
```

### Port Already in Use
Change PORT in `.env` to a different number (e.g., 3001)

### TypeScript Errors
```bash
npm run build
```
Check for any compilation errors.

---

## 📖 Full Documentation

See [README.md](file:///c:/Users/Bismilah/Documents/arwa/README.md) for complete API documentation.

---

## ✨ You're Ready!

Your School Management System backend is fully set up and ready to use! 🎉
