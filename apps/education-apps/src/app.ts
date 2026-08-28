import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import { errorMiddleware } from './middlewares/error.middleware';

// Import routes
import authRoutes from './auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import studentsRoutes from './modules/students/students.routes';
import inscriptionsRoutes from './modules/inscriptions/inscriptions.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import settingsRoutes from './modules/settings/settings.routes';
import formationsRoutes from './modules/formations/formations.routes';
import documentsRoutes from './modules/documents/documents.routes';
import pricingRoutes from './modules/pricing/pricing.routes';
import groupsRoutes from './modules/groups/groups.routes';
import teachersRoutes from './modules/teachers/teachers.routes';
import transactionsRoutes from './modules/transactions/transactions.routes';

const app: Application = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ================= HEALTH CHECK =================
app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'Server is running' });
});

// ================= API ROUTES =================
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/students', studentsRoutes);
apiRouter.use('/inscriptions', inscriptionsRoutes);
apiRouter.use('/payments', paymentsRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/formations', formationsRoutes);
apiRouter.use('/documents', documentsRoutes);
apiRouter.use('/pricing', pricingRoutes);
apiRouter.use('/groups', groupsRoutes);
apiRouter.use('/teachers', teachersRoutes);
apiRouter.use('/transactions', transactionsRoutes);

app.use('/api', apiRouter);

// ================= FRONTEND STATIC =================
// path ديال build ديال frontend (Vite)
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// أي route ماشي API → frontend
app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ================= ERROR HANDLING =================
app.use(errorMiddleware);

export default app;
