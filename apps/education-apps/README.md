# School Management System Backend

Complete backend system for managing students, inscriptions, payments, attendance, and school settings with role-based access control.

## Features

- **JWT Authentication** with bcrypt password hashing
- **Role-Based Access Control** (Admin & Secretary)
- **PostgreSQL Database** with Prisma ORM
- **RESTful API** with Express.js
- **TypeScript** for type safety
- **Modular Architecture** with clean separation of concerns

## Tech Stack

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT (jsonwebtoken)
- bcrypt
- TypeScript

## Project Structure

```
/src
   /config          - Database and environment configuration
   /middlewares     - Auth, role, and error middlewares
   /auth            - Authentication module (login)
   /modules
      /users        - User management (ADMIN only)
      /students     - Student management (ADMIN, SECRETARY)
      /inscriptions - Inscription management (ADMIN, SECRETARY)
      /payments     - Payment records (ADMIN only)
      /attendance   - Attendance tracking (ADMIN only)
      /settings     - School settings (ADMIN only)
   /utils           - JWT, bcrypt, and response utilities
   app.ts           - Express app configuration
   server.ts        - Server entry point
/prisma
   schema.prisma    - Database schema
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update with your database credentials:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/school_management?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to manage data
npm run prisma:studio
```

### 4. Create Admin User

Use Prisma Studio or create a seed script to add your first admin user:

```typescript
// Example: Create admin user with hashed password
{
  email: "admin@school.com",
  password: "$2b$10$...", // Use bcrypt to hash your password
  name: "Admin User",
  role: "ADMIN"
}
```

### 5. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 6. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login with email and password

### Users (ADMIN only)
- `POST /users` - Create user
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Students (ADMIN, SECRETARY)
- `POST /students` - Create student
- `GET /students` - Get all students
- `GET /students/:id` - Get student by ID
- `PUT /students/:id` - Update student
- `DELETE /students/:id` - Delete student

### Inscriptions (ADMIN, SECRETARY)
- `POST /inscriptions` - Create inscription
- `GET /inscriptions` - Get all inscriptions
- `GET /inscriptions/:id` - Get inscription by ID
- `PUT /inscriptions/:id` - Update inscription
- `DELETE /inscriptions/:id` - Delete inscription

**Inscription Categories:**
- **SOUTIEN**: math, physique, svt, francais, anglais, calcul_mental, couran, autre
- **FORMATION**: coiffure, bureautique, ecommerce, autre

### Payments (ADMIN only)
- `POST /payments` - Create payment
- `GET /payments` - Get all payments
- `GET /payments/:id` - Get payment by ID

### Attendance (ADMIN only)
- `POST /attendance` - Create attendance record
- `GET /attendance/student/:id` - Get attendance by student

### Settings (ADMIN only)
- `GET /settings` - Get school settings
- `PUT /settings` - Update school settings

## Role-Based Access

### ADMIN
- Full access to all modules
- Can manage users, students, inscriptions, payments, attendance, and settings

### SECRETARY
- **Limited access** to only:
  - Students module (view and manage)
  - Inscriptions module (view and manage)

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Login Example

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.com",
    "password": "yourpassword"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "admin@school.com",
      "name": "Admin User",
      "role": "ADMIN"
    }
  },
  "message": "Login successful"
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "message": "Additional context"
}
```

## Database Models

- **User**: Admin and Secretary accounts
- **Student**: Student information
- **Inscription**: Student course enrollments (SOUTIEN/FORMATION)
- **Payment**: Payment records for thermal printing
- **Attendance**: Daily attendance tracking
- **Settings**: School configuration (name, logo, academic year, contact)

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## License

ISC
