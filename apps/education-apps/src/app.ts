import express, { Application } from 'express';
import cors from 'cors';
import { errorMiddleware } from './middlewares/error.middleware';

// Import routes
import authRoutes from './auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import studentsRoutes from './modules/students/students.routes';
import studentsImportRoutes from './modules/students-import/importStudents.routes';
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
import parentsRoutes from './modules/parents/parents.routes';
import schoolsRoutes from './modules/schools/schools.routes';
import branchesRoutes from './modules/branches/branches.routes';
import announcementsRoutes from './modules/announcements/announcements.routes';
import holidaysRoutes from './modules/holidays/holidays.routes';
import transportRoutes from './modules/transport/transport.routes';
import packsRoutes from './modules/packs/packs.routes';
import salesAgentsRoutes from './modules/sales-agents/salesAgents.routes';
import agentRoutes from './modules/sales-agents/agent.routes';
import partnerOfferRoutes from './modules/partner-offer/partnerOffer.routes';
import platformRoutes from './modules/platform/platform.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import gradesRoutes from './modules/grades/grades.routes';
import teacherPortalRoutes from './modules/teacher-portal/teacherPortal.routes';
import pushRoutes from './modules/notifications/push.routes';
import whatsappRoutes from './modules/notifications/whatsapp.routes';
import activitiesRoutes from './modules/activities/activities.routes';
import homeworkRoutes from './modules/homework/homework.routes';

const app: Application = express();

// Behind proxies (Traefik, then the Next.js /api rewrite) every request comes from the proxy's IP, so the
// per-IP rate limits (signup, code check) were shared by all visitors. TRUST_PROXY = number of proxy hops
// in front of this server (e.g. 2 on Coolify). Unset locally: Express keeps using the socket address.
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY ?? '', 10);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
}

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
apiRouter.use('/students/import', studentsImportRoutes);
apiRouter.use('/students', studentsRoutes);
apiRouter.use('/parents', parentsRoutes);
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
apiRouter.use('/schools', schoolsRoutes);
apiRouter.use('/branches', branchesRoutes);
apiRouter.use('/announcements', announcementsRoutes);
apiRouter.use('/holidays', holidaysRoutes);
apiRouter.use('/transport', transportRoutes);
apiRouter.use('/packs', packsRoutes);
apiRouter.use('/sales-agents', salesAgentsRoutes);
apiRouter.use('/partner-offer', partnerOfferRoutes);
apiRouter.use('/agent', agentRoutes);
apiRouter.use('/platform', platformRoutes);
apiRouter.use('/school', subscriptionRoutes);
apiRouter.use('/grades', gradesRoutes);
apiRouter.use('/teacher-portal', teacherPortalRoutes);
apiRouter.use('/push', pushRoutes);
apiRouter.use('/whatsapp', whatsappRoutes);
apiRouter.use('/activities', activitiesRoutes);
apiRouter.use('/homework', homeworkRoutes);

app.use('/api', apiRouter);

// ================= ERROR HANDLING =================
app.use(errorMiddleware);

export default app;
