/**
 * Idempotent demo data for local demos/screenshots: one demo school per institution type,
 * each with a secretary (plus teachers, groups and students for the newly created schools).
 *
 * LOCAL USE ONLY. It drives the real HTTP API (no direct DB writes), so all validations apply.
 *
 * Credentials come from environment variables only (never hard-code or commit them):
 *   SUPER_ADMIN_EMAIL     super admin used to activate the demo schools
 *   SUPER_ADMIN_PASSWORD
 *   DEMO_PASSWORD         password given to every demo owner/secretary created here
 *   EXISTING_OWNER_PASSWORD  optional, password of the pre-existing demo owners (Al Amal, Les Petits
 *                         Lutins) when it differs from DEMO_PASSWORD; needed to add their secretary
 *   API_URL               optional, default http://localhost:3010/api
 *
 * Run from apps/education-apps:
 *   npx ts-node --transpile-only scripts/seed-demo-schools.ts
 *
 * Re-running creates nothing that already exists (matched by email / name).
 */

const API = process.env.API_URL || 'http://localhost:3010/api';
const REFERRAL_CODE = 'ARWA';

const need = (name: string): string => {
    const v = process.env[name];
    if (!v) {
        console.error(`Missing env var ${name}`);
        process.exit(1);
    }
    return v;
};

const SUPER_ADMIN_EMAIL = need('SUPER_ADMIN_EMAIL');
const SUPER_ADMIN_PASSWORD = need('SUPER_ADMIN_PASSWORD');
const DEMO_PASSWORD = need('DEMO_PASSWORD');
const EXISTING_OWNER_PASSWORD = process.env.EXISTING_OWNER_PASSWORD || DEMO_PASSWORD;

type Slot = { day: string; startTime: string; endTime: string };
interface TeacherSeed { name: string; specialties: string[]; levels: string[]; phone: string }
interface GroupSeed {
    name: string; subject: string; level: string; teacher: string; room: string; slots: Slot[]; students: string[];
    monthly: number;        // monthly fee in MAD
    category: string;       // inscription category (SOUTIEN subject slug, or the formation name)
    formation?: { name: string; duration: string; description: string }; // set => FORMATION group
}
interface StudentSeed { name: string; surname: string; level: string; parentName: string; parentPhone: string }

interface SchoolSeed {
    name: string;
    type: string;
    ownerName: string;
    ownerEmail: string;
    city: string;
    secretaryEmail: string;
    secretaryName: string;
    // Only for schools this script creates: content to populate.
    signup?: boolean;
    teachers?: TeacherSeed[];
    students?: StudentSeed[];
    groups?: GroupSeed[];
}

const st = (name: string, surname: string, level: string, parent: string, phone: string): StudentSeed =>
    ({ name, surname, level, parentName: parent, parentPhone: phone });
const full = (s: StudentSeed) => `${s.name} ${s.surname}`;

const SCHOOLS: SchoolSeed[] = [
    {
        name: 'Groupe Scolaire Al Amal',
        type: 'PRIVATE_SCHOOL',
        ownerName: 'Demo Ecole',
        ownerEmail: 'demo.ecole@smartschool.ma',
        city: '',
        secretaryEmail: 'secretaire.alamal@smartschool.ma',
        secretaryName: 'Secrétaire Al Amal',
    },
    {
        name: 'Crèche Les Petits Lutins',
        type: 'CRECHE',
        ownerName: 'Demo Creche',
        ownerEmail: 'demo.creche@smartschool.ma',
        city: '',
        secretaryEmail: 'secretaire.lutins@smartschool.ma',
        secretaryName: 'Secrétaire Les Petits Lutins',
    },
    {
        name: 'Centre de Soutien Ibn Khaldoun',
        type: 'TUTORING_CENTER',
        ownerName: 'Karim Benjelloun',
        ownerEmail: 'demo.soutien@smartschool.ma',
        city: 'Casablanca',
        secretaryEmail: 'secretaire.ibnkhaldoun@smartschool.ma',
        secretaryName: 'Salma Idrissi',
        signup: true,
        teachers: [
            { name: 'Youssef El Fassi', specialties: ['Mathématiques'], levels: ['Lycée'], phone: '0661000101' },
            { name: 'Nadia Berrada', specialties: ['Physique-Chimie'], levels: ['Lycée'], phone: '0661000102' },
            { name: 'Hicham Tazi', specialties: ['Français'], levels: ['Collège', 'Lycée'], phone: '0661000103' },
        ],
        students: [
            st('Amine', 'Alaoui', 'Lycée', 'Rachid Alaoui', '0662000201'),
            st('Salma', 'Bennani', 'Lycée', 'Fatima Bennani', '0662000202'),
            st('Omar', 'Chraibi', 'Lycée', 'Driss Chraibi', '0662000203'),
            st('Imane', 'El Amrani', 'Lycée', 'Samira El Amrani', '0662000204'),
            st('Yassine', 'Lahlou', 'Collège', 'Mohamed Lahlou', '0662000205'),
            st('Khadija', 'Mansouri', 'Lycée', 'Latifa Mansouri', '0662000206'),
            st('Reda', 'Sebti', 'Collège', 'Abdelilah Sebti', '0662000207'),
            st('Meryem', 'Zniber', 'Lycée', 'Naima Zniber', '0662000208'),
            st('Ayoub', 'Kettani', 'Collège', 'Hassan Kettani', '0662000209'),
        ],
        groups: [
            {
                name: 'Maths Terminale - Soir', monthly: 400, category: 'math', subject: 'Mathématiques', level: 'Lycée', teacher: 'Youssef El Fassi', room: 'Salle 1',
                slots: [
                    { day: 'Lundi', startTime: '18:00', endTime: '20:00' },
                    { day: 'Mercredi', startTime: '18:00', endTime: '20:00' },
                ],
                students: ['Amine Alaoui', 'Salma Bennani', 'Omar Chraibi', 'Meryem Zniber'],
            },
            {
                name: 'Physique 1ère Bac - Week-end', monthly: 350, category: 'physique', subject: 'Physique-Chimie', level: 'Lycée', teacher: 'Nadia Berrada', room: 'Salle 2',
                slots: [
                    { day: 'Samedi', startTime: '10:00', endTime: '12:00' },
                    { day: 'Dimanche', startTime: '10:00', endTime: '12:00' },
                ],
                students: ['Imane El Amrani', 'Khadija Mansouri', 'Omar Chraibi', 'Salma Bennani'],
            },
            {
                name: 'Français 3ème Collège', monthly: 250, category: 'francais', subject: 'Français', level: 'Collège', teacher: 'Hicham Tazi', room: 'Salle 3',
                slots: [
                    { day: 'Mardi', startTime: '17:30', endTime: '19:00' },
                    { day: 'Jeudi', startTime: '17:30', endTime: '19:00' },
                ],
                students: ['Yassine Lahlou', 'Reda Sebti', 'Ayoub Kettani'],
            },
        ],
    },
    {
        name: 'Institut de Formation Al Moustaqbal',
        type: 'VOCATIONAL_TRAINING',
        ownerName: 'Laila Cherkaoui',
        ownerEmail: 'demo.formation@smartschool.ma',
        city: 'Rabat',
        secretaryEmail: 'secretaire.almoustaqbal@smartschool.ma',
        secretaryName: 'Hanane Ouazzani',
        signup: true,
        teachers: [
            { name: 'Mehdi Benkirane', specialties: ['Informatique'], levels: ['Technicien'], phone: '0663000101' },
            { name: 'Zineb Lamrani', specialties: ['Comptabilité'], levels: ['Technicien'], phone: '0663000102' },
            { name: 'Anas Filali', specialties: ['Design graphique'], levels: ['Qualification'], phone: '0663000103' },
        ],
        students: [
            st('Soufiane', 'Bouzidi', 'Technicien', 'Abdelkader Bouzidi', '0664000201'),
            st('Hajar', 'Naciri', 'Technicien', 'Malika Naciri', '0664000202'),
            st('Badr', 'Hajji', 'Technicien', 'Said Hajji', '0664000203'),
            st('Lamia', 'Rhazi', 'Technicien', 'Amina Rhazi', '0664000204'),
            st('Ilyas', 'Squalli', 'Qualification', 'Brahim Squalli', '0664000205'),
            st('Chaimae', 'Tahiri', 'Technicien', 'Khalid Tahiri', '0664000206'),
            st('Walid', 'Benali', 'Qualification', 'Mustapha Benali', '0664000207'),
            st('Sara', 'El Idrissi', 'Qualification', 'Houda El Idrissi', '0664000208'),
            st('Mounir', 'Guessous', 'Technicien', 'Jamal Guessous', '0664000209'),
            st('Aya', 'Slaoui', 'Qualification', 'Nabil Slaoui', '0664000210'),
        ],
        groups: [
            {
                name: 'Développement Informatique - Promo 1', monthly: 1200, category: 'Informatique', formation: { name: 'Informatique', duration: '6 mois', description: 'Développement web et applications' }, subject: 'Informatique', level: 'Technicien', teacher: 'Mehdi Benkirane', room: 'Labo 1',
                slots: [
                    { day: 'Lundi', startTime: '09:00', endTime: '12:30' },
                    { day: 'Mercredi', startTime: '09:00', endTime: '12:30' },
                    { day: 'Vendredi', startTime: '09:00', endTime: '12:30' },
                ],
                students: ['Soufiane Bouzidi', 'Badr Hajji', 'Mounir Guessous', 'Hajar Naciri'],
            },
            {
                name: 'Comptabilité et Gestion', monthly: 800, category: 'Comptabilité', formation: { name: 'Comptabilité', duration: '6 mois', description: 'Comptabilité générale et gestion' }, subject: 'Comptabilité', level: 'Technicien', teacher: 'Zineb Lamrani', room: 'Salle A',
                slots: [
                    { day: 'Mardi', startTime: '14:00', endTime: '18:00' },
                    { day: 'Jeudi', startTime: '14:00', endTime: '18:00' },
                ],
                students: ['Lamia Rhazi', 'Chaimae Tahiri', 'Hajar Naciri'],
            },
            {
                name: 'Design Graphique - Soir', monthly: 900, category: 'Design graphique', formation: { name: 'Design graphique', duration: '4 mois', description: 'Photoshop, Illustrator et identité visuelle' }, subject: 'Design graphique', level: 'Qualification', teacher: 'Anas Filali', room: 'Atelier',
                slots: [
                    { day: 'Mardi', startTime: '18:00', endTime: '21:00' },
                    { day: 'Samedi', startTime: '09:00', endTime: '13:00' },
                ],
                students: ['Ilyas Squalli', 'Walid Benali', 'Sara El Idrissi', 'Aya Slaoui'],
            },
        ],
    },
    {
        name: 'Centre de Langues Atlas',
        type: 'LANGUAGE_CENTER',
        ownerName: 'Rachid Amrani',
        ownerEmail: 'demo.langues@smartschool.ma',
        city: 'Marrakech',
        secretaryEmail: 'secretaire.atlas@smartschool.ma',
        secretaryName: 'Kenza Berrada',
        signup: true,
        teachers: [
            { name: 'Sarah Johnson', specialties: ['Anglais'], levels: ['A1', 'B1'], phone: '0665000101' },
            { name: 'Mariam Ouali', specialties: ['Français'], levels: ['A2', 'B2'], phone: '0665000102' },
            { name: 'Carlos Ruiz', specialties: ['Espagnol'], levels: ['A1'], phone: '0665000103' },
        ],
        students: [
            st('Ghita', 'Alami', 'A1', 'Karima Alami', '0666000201'),
            st('Anouar', 'Bakkali', 'B1', 'Larbi Bakkali', '0666000202'),
            st('Nour', 'Daoudi', 'A1', 'Zahra Daoudi', '0666000203'),
            st('Hamza', 'Essakali', 'B1', 'Tarik Essakali', '0666000204'),
            st('Rania', 'Fassi Fihri', 'A2', 'Siham Fassi Fihri', '0666000205'),
            st('Taha', 'Jabri', 'B2', 'Aziz Jabri', '0666000206'),
            st('Loubna', 'Kabbaj', 'A1', 'Habiba Kabbaj', '0666000207'),
            st('Zakaria', 'Moussaoui', 'A2', 'Redouane Moussaoui', '0666000208'),
        ],
        groups: [
            {
                name: 'Anglais A1 - Débutants', monthly: 500, category: 'anglais', subject: 'Anglais', level: 'A1', teacher: 'Sarah Johnson', room: 'Salle 1',
                slots: [
                    { day: 'Lundi', startTime: '17:00', endTime: '18:30' },
                    { day: 'Mercredi', startTime: '17:00', endTime: '18:30' },
                ],
                students: ['Ghita Alami', 'Nour Daoudi', 'Loubna Kabbaj'],
            },
            {
                name: 'Français B2 - Avancé', monthly: 600, category: 'francais', subject: 'Français', level: 'B2', teacher: 'Mariam Ouali', room: 'Salle 2',
                slots: [
                    { day: 'Mardi', startTime: '18:00', endTime: '19:30' },
                    { day: 'Jeudi', startTime: '18:00', endTime: '19:30' },
                ],
                students: ['Taha Jabri', 'Rania Fassi Fihri', 'Anouar Bakkali'],
            },
            {
                name: 'Espagnol A1 - Samedi', monthly: 450, category: 'espagnol', subject: 'Espagnol', level: 'A1', teacher: 'Carlos Ruiz', room: 'Salle 3',
                slots: [{ day: 'Samedi', startTime: '10:00', endTime: '12:00' }],
                students: ['Hamza Essakali', 'Zakaria Moussaoui', 'Ghita Alami'],
            },
        ],
    },
];

const counts: Record<string, Record<string, number>> = {};
const failures: string[] = [];
const bump = (school: string, key: string) => {
    counts[school] = counts[school] || {};
    counts[school][key] = (counts[school][key] || 0) + 1;
};

interface Result<T = any> { ok: boolean; status: number; data?: T; error?: string }

const call = async <T = any>(
    method: string,
    path: string,
    opts: { token?: string; branchId?: string; body?: unknown } = {}
): Promise<Result<T>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.branchId) headers['X-Branch-Id'] = opts.branchId;
    const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const json: any = await res.json().catch(() => ({}));
    return {
        ok: res.ok && json.success !== false,
        status: res.status,
        data: json.success === undefined && res.ok ? json : json.data,
        error: json.error || json.message,
    };
};

const login = async (email: string, password: string): Promise<string | null> => {
    const r = await call<{ token: string }>('POST', '/auth/login', { body: { email, password } });
    return r.ok ? r.data!.token : null;
};

const fail = (school: string, what: string, r: Result) => {
    const msg = `[${school}] ${what}: ${r.status} ${r.error}`;
    failures.push(msg);
    console.error('  FAIL ' + msg);
};

const seedContent = async (seed: SchoolSeed, token: string, branchId: string) => {
    const o = { token, branchId };

    const teachersRes = await call<any[]>('GET', '/teachers', o);
    const studentsRes = await call<any[]>('GET', '/students', o);
    const groupsRes = await call<any[]>('GET', '/groups', o);
    if (!teachersRes.ok || !studentsRes.ok || !groupsRes.ok) {
        fail(seed.name, 'listing existing content', !teachersRes.ok ? teachersRes : !studentsRes.ok ? studentsRes : groupsRes);
        return;
    }

    const teacherIds = new Map<string, string>(teachersRes.data!.map((t) => [t.name, t.id]));
    for (const t of seed.teachers || []) {
        if (teacherIds.has(t.name)) continue;
        const r = await call('POST', '/teachers', { ...o, body: { ...t, status: 'ACTIVE' } });
        if (r.ok) { teacherIds.set(t.name, r.data.id); bump(seed.name, 'teachers'); } else fail(seed.name, `teacher ${t.name}`, r);
    }

    const studentIds = new Map<string, string>(studentsRes.data!.map((s) => [`${s.name} ${s.surname}`, s.id]));
    for (const s of seed.students || []) {
        if (studentIds.has(full(s))) continue;
        const r = await call('POST', '/students', {
            ...o,
            body: { name: s.name, surname: s.surname, schoolLevel: s.level, parentName: s.parentName, parentPhone: s.parentPhone, address: seed.city },
        });
        if (r.ok) { studentIds.set(full(s), r.data.id); bump(seed.name, 'students'); } else fail(seed.name, `student ${full(s)}`, r);
    }

    // Vocational groups are FORMATION groups linked to a Formation. Group type can't be edited,
    // so a leftover SOUTIEN version (from an earlier run) is deleted and recreated.
    const formationsRes = await call<any[]>('GET', '/formations', o);
    if (!formationsRes.ok) { fail(seed.name, 'list formations', formationsRes); return; }
    const formationIds = new Map<string, string>(formationsRes.data!.map((f) => [f.name, f.id]));
    for (const g of seed.groups || []) {
        const f = g.formation;
        if (!f || formationIds.has(f.name)) continue;
        const r = await call('POST', '/formations', { ...o, body: { name: f.name, duration: f.duration, price: g.monthly, description: f.description } });
        if (r.ok) { formationIds.set(f.name, r.data.id); bump(seed.name, 'formations'); } else fail(seed.name, `formation ${f.name}`, r);
    }

    const existingGroups = new Map<string, any>(groupsRes.data!.map((g) => [g.name, g]));
    for (const g of seed.groups || []) {
        const existing = existingGroups.get(g.name);
        if (existing && !(g.formation && existing.type !== 'FORMATION')) continue;
        if (existing) {
            const d = await call('DELETE', `/groups/${existing.id}`, o);
            if (!d.ok) { fail(seed.name, `replace group ${g.name}`, d); continue; }
        }
        const r = await call('POST', '/groups', {
            ...o,
            body: {
                name: g.name,
                type: g.formation ? 'FORMATION' : 'SOUTIEN',
                formationId: g.formation ? formationIds.get(g.formation.name) : undefined,
                subject: g.subject,
                level: g.level,
                room: g.room,
                teacherId: teacherIds.get(g.teacher),
                timeSlots: g.slots,
                studentIds: g.students.map((n) => studentIds.get(n)).filter(Boolean),
            },
        });
        if (r.ok) bump(seed.name, 'groups'); else fail(seed.name, `group ${g.name}`, r);
    }

    await seedFinance(seed, o, studentIds);
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthLabel = (iso: string) => `${MONTHS_FR[new Date(iso).getMonth()]} ${new Date(iso).getFullYear()}`;

// One monthly inscription per month for each student, linked to their group's subject/formation.
// POST /inscriptions auto-creates a payment of the full amount, so "paid" months are plain
// inscriptions; an owing month is created with amount 0 (no payment) then raised with PUT, and a
// partially paid one gets a smaller payment through POST /payments. Students rotate through
// 4 patterns so the finance pages show paid, partially paid and unpaid students.
const seedFinance = async (
    seed: SchoolSeed,
    o: { token: string; branchId: string },
    studentIds: Map<string, string>
) => {
    const inscRes = await call<any[]>('GET', '/inscriptions', o);
    if (!inscRes.ok) { fail(seed.name, 'list inscriptions', inscRes); return; }
    const enrolled = new Set(inscRes.data!.map((i) => String(i.studentId)));

    const students = seed.students || [];
    for (let idx = 0; idx < students.length; idx += 1) {
        const name = full(students[idx]);
        const studentId = studentIds.get(name);
        const group = (seed.groups || []).find((g) => g.students.includes(name));
        if (!studentId || !group || enrolled.has(studentId)) continue;

        const type = group.formation ? 'FORMATION' : 'SOUTIEN';
        const pattern = idx % 4;
        // [days ago, state]: 'paid' | 'partial' | 'unpaid'
        const months: [number, string][] = [
            pattern === 2 ? [70, 'paid'] : [75, 'paid'],
            [45, pattern === 2 ? 'unpaid' : 'paid'],
        ];
        if (pattern !== 2) months.push([5, pattern === 0 ? 'paid' : pattern === 1 ? 'partial' : 'unpaid']);
        if (pattern === 0) months.unshift([105, 'paid']);

        for (const [ago, state] of months) {
            const date = daysAgo(ago);
            const base = { studentId, type, category: group.category, date, note: `Mensualité ${monthLabel(date)} - ${group.name}` };
            const r = await call('POST', '/inscriptions', { ...o, body: { ...base, amount: state === 'paid' ? group.monthly : 0 } });
            if (!r.ok) { fail(seed.name, `inscription ${name}`, r); break; }
            bump(seed.name, 'inscriptions');
            if (state === 'paid') { bump(seed.name, 'payments'); continue; }

            const u = await call('PUT', `/inscriptions/${r.data.id}`, { ...o, body: { amount: group.monthly } });
            if (!u.ok) { fail(seed.name, `inscription amount ${name}`, u); break; }
            if (state === 'partial') {
                const p = await call('POST', '/payments', {
                    ...o,
                    body: { studentId, amount: Math.round(group.monthly / 2), method: 'CASH', date, note: `Acompte ${monthLabel(date)}` },
                });
                if (p.ok) bump(seed.name, 'payments'); else fail(seed.name, `payment ${name}`, p);
            }
        }
    }
};

const main = async () => {
    const adminToken = await login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    if (!adminToken) {
        console.error('Super admin login failed (check SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD, and that the API is up)');
        process.exit(1);
    }

    for (const seed of SCHOOLS) {
        console.log(`\n== ${seed.name} (${seed.type})`);

        let list = await call<any[]>('GET', '/schools', { token: adminToken });
        if (!list.ok) { fail(seed.name, 'list schools', list); continue; }
        let school = list.data!.find((s) => s.name === seed.name || s.ownerEmail === seed.ownerEmail);

        // 1. School
        if (!school) {
            if (!seed.signup) { fail(seed.name, 'expected existing demo school not found', { ok: false, status: 0, error: 'missing' }); continue; }
            const r = await call('POST', '/schools/signup', {
                body: {
                    schoolName: seed.name,
                    ownerName: seed.ownerName,
                    ownerEmail: seed.ownerEmail,
                    password: DEMO_PASSWORD,
                    branchCity: seed.city,
                    institutionType: seed.type,
                    referralCode: REFERRAL_CODE,
                },
            });
            if (!r.ok) { fail(seed.name, 'signup', r); continue; }
            bump(seed.name, 'school');
            list = await call<any[]>('GET', '/schools', { token: adminToken });
            school = list.data!.find((s) => s.ownerEmail === seed.ownerEmail);
        }

        // 2. Activate (needed: PENDING + expired trial blocks writes)
        if (school.status !== 'ACTIVE') {
            const r = await call('PATCH', `/schools/${school.id}/status`, { token: adminToken, body: { status: 'ACTIVE' } });
            if (r.ok) bump(seed.name, 'activated'); else { fail(seed.name, 'activate', r); continue; }
        }

        // 3. Owner session + branch
        const ownerToken = await login(seed.ownerEmail, seed.signup ? DEMO_PASSWORD : EXISTING_OWNER_PASSWORD);
        if (!ownerToken) {
            fail(seed.name, 'owner login (password differs from DEMO_PASSWORD?)', { ok: false, status: 401, error: 'login failed' });
            continue;
        }
        const branches = await call<any[]>('GET', '/branches', { token: ownerToken });
        const branchId = branches.data?.[0]?.id;
        if (!branches.ok || !branchId) { fail(seed.name, 'branches', branches); continue; }

        // 4. Secretary
        const users = await call<any[]>('GET', '/users', { token: ownerToken, branchId });
        if (!users.ok) { fail(seed.name, 'list users', users); continue; }
        if (!users.data!.some((u) => u.email === seed.secretaryEmail)) {
            const r = await call('POST', '/users', {
                token: ownerToken, branchId,
                body: { email: seed.secretaryEmail, password: DEMO_PASSWORD, name: seed.secretaryName, role: 'SECRETARY' },
            });
            if (r.ok) bump(seed.name, 'secretary'); else fail(seed.name, 'secretary', r);
        }

        // 5. Content (only for schools this script owns)
        if (seed.signup) await seedContent(seed, ownerToken, branchId);
    }

    console.log('\n=== Created this run');
    for (const s of SCHOOLS) console.log(`${s.name}:`, JSON.stringify(counts[s.name] || {}));
    if (failures.length) {
        console.log(`\n${failures.length} failure(s)`);
        process.exitCode = 1;
    }
};

main().catch((e) => { console.error(e); process.exit(1); });
