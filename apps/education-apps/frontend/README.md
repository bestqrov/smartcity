# Smart School - Frontend

Next.js 14 frontend application for the Smart School Management System with role-based access control.

## Features

- **Role-Based Access Control**: Admin and Secretary roles with different permissions
- **JWT Authentication**: Secure token-based authentication
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Modern UI**: Clean, professional interface with Lucide icons
- **Type Safety**: Full TypeScript support
- **State Management**: Zustand for global state

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Zustand (State Management)
- Axios (HTTP Client)
- Lucide React (Icons)

## Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:3000`

## Installation

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

   The app will run on `http://localhost:3001`

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── login/             # Login page
│   ├── register-admin/    # Admin registration
│   ├── admin/             # Admin dashboard & pages
│   └── secretary/         # Secretary dashboard & pages
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── auth/             # Auth wrappers
├── lib/                   # Core utilities
│   ├── api.ts            # Axios instance
│   ├── auth.ts           # Auth functions
│   ├── utils.ts          # Helper functions
│   └── services/         # API services
├── hooks/                 # Custom React hooks
├── store/                 # Zustand stores
├── types/                 # TypeScript types
└── public/               # Static assets
```

## User Roles & Access

### Admin
- Full access to all modules
- Can manage:
  - Users (create admin/secretary accounts)
  - Students
  - Inscriptions
  - Payments
  - Attendance
  - School Settings

### Secretary
- Limited access to:
  - Students (view and manage)
  - Inscriptions (full CRUD)
- Cannot access:
  - Users management
  - Payments
  - Attendance
  - Settings

## Available Scripts

- `npm run dev` - Start development server (port 3001)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Key Features

### Authentication
- Animated login page with email/password
- Admin registration for first-time setup
- JWT token management with auto-refresh
- Role-based route protection

### Inscriptions
- Two types: SOUTIEN and FORMATION
- Dynamic category selection based on type
- **SOUTIEN categories**: math, physique, svt, francais, anglais, calcul_mental, couran, autre
- **FORMATION categories**: coiffure, bureautique, ecommerce, autre

### Payments & Receipts
- Create payment records
- Thermal receipt printing (80mm width)
- Print-optimized layout for thermal printers

### Students Management
- Full CRUD operations
- Search functionality
- Detailed student profiles

## API Integration

The frontend connects to the backend API at `http://localhost:3000` by default.

All API calls include:
- JWT token in Authorization header
- Automatic token refresh on 401
- Error handling with user-friendly messages

## Development

### Adding a New Page

1. Create page in `app/[role]/[module]/page.tsx`
2. Wrap with `RequireRole` if needed
3. Create API service in `lib/services/`
4. Add navigation link in layout

### Creating a Component

1. Add to `components/ui/` for reusable UI
2. Use TypeScript for props
3. Follow Tailwind CSS conventions
4. Add accessibility attributes

## Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

3. **Environment Variables**:
   - Set `NEXT_PUBLIC_API_URL` to your production API URL

## Troubleshooting

### API Connection Issues
- Verify backend is running on port 3000
- Check CORS configuration in backend
- Ensure `NEXT_PUBLIC_API_URL` is correct

### Authentication Errors
- Clear browser localStorage
- Check JWT token expiration
- Verify backend auth endpoints

### Build Errors
- Run `npm install` to ensure dependencies are installed
- Check TypeScript errors with `npm run lint`
- Verify all imports are correct

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

ISC
