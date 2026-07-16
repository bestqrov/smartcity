# SmartCity Tourism – Project Documentation

Ce document résume l’architecture, les modules implémentés, les identifiants de test et la procédure de démarrage du projet SmartCity (focus tourisme).

---

## 1. Vue d’ensemble

SmartCity est un écosystème multi-services (tourisme, santé, éducation, services publics). Cette documentation couvre le module **Tourisme** qui a été complété : backend, gateway sécurisée, frontend Next.js avec i18n, authentification JWT et dashboard admin.

- **Monorepo** : `pnpm` workspaces + `turbo`
- **Base de données** : MongoDB Atlas (cluster cloud) – Prisma ORM
- **Cache / sessions** : Redis
- **Frontend** : Next.js 15 + React 19 + Tailwind CSS
- **Backend** : NestJS microservices + API Gateway
- **Authentification** : JWT (access + refresh tokens), guards rôles
- **Internationalisation** : ar, fr, en

> **Changement important** : la base de données locale en mémoire a été remplacée par un cluster MongoDB Atlas pour assurer la persistance et éviter les problèmes de `readConcern majority` rencontrés avec les replicas sets en mémoire.

---

## 2. Structure du repo

```
smartcity/
├── apps/
│   └── tourism-app/            # Frontend Next.js (port 3102)
├── services/
│   ├── gateway/                # API Gateway (port 3000)
│   ├── user-service/           # Auth + utilisateurs + tenants (port 3001)
│   └── tourism-service/        # Hôtels, chambres, réservations, etc. (port 3002)
├── packages/
│   ├── database/               # Prisma schema + seed
│   ├── i18n/                   # Translations ar/fr/en
│   ├── types/                  # Types partagés
│   └── ui-components/          # Composants UI partagés
├── docker-compose.yml
└── .env.example
```

---

## 3. Modules backend implémentés

### 3.1 `user-service`

| Module | Fichiers | Description |
|--------|----------|-------------|
| Auth | `auth.controller.ts`, `auth.service.ts` | Login, register, refresh, logout, forgot/reset password |
| Users | `users.controller.ts`, `users.service.ts` | CRUD utilisateurs, profils |
| Tenants | `tenants.controller.ts`, `tenants.service.ts` | Gestion des établissements (hôtels, riads…) |
| JWT Guards | `jwt-auth.guard.ts`, `jwt.strategy.ts` | Protection JWT globale + décorateur `@Public()` |
| Roles Guard | `roles.guard.ts`, `roles.decorator.ts` | Contrôle d’accès par rôle (`SUPER_ADMIN`, `ADMIN`, etc.) |
| Health | `health.controller.ts` | Endpoint de santé |

### 3.2 `tourism-service`

| Module | Fichiers | Description |
|--------|----------|-------------|
| Hotels | `hotels.controller.ts`, `hotels.service.ts` | CRUD hôtels, recherche |
| Rooms | `rooms.controller.ts`, `rooms.service.ts` | Gestion des chambres |
| Bookings | `bookings.controller.ts`, `bookings.service.ts` | Réservations, statuts, paiement |
| Restaurants | `restaurants.controller.ts`, `restaurants.service.ts` | Restaurants des hôtels |
| Activities | `activities.controller.ts`, `activities.service.ts` | Activités / excursions |
| Reviews | `reviews.controller.ts`, `reviews.service.ts` | Avis clients |
| Orders | `orders.controller.ts`, `orders.service.ts` | Commandes room-service |
| QR | `qr.controller.ts`, `qr.service.ts` | Génération et validation QR check-in |
| Auth | `jwt-auth.guard.ts`, `roles.guard.ts`, `jwt.strategy.ts` | Protection JWT + rôles |
| Health | `health.controller.ts`, `health.service.ts` | Endpoint de santé |

### 3.3 `gateway`

Le gateway expose tout sous `/api` et route vers les bons services. Le middleware proxy est maintenant appliqué à **toutes les routes** (`path: '*'`), ce qui garantit que toutes les requêtes `/api/...` sont correctement transmises :

| Préfixe | Service | Port |
|---------|---------|------|
| `/api/auth/*`, `/api/users/*`, `/api/tenants/*` | user-service | 3001 |
| `/api/hotels/*`, `/api/rooms/*`, `/api/bookings/*`, `/api/activities/*`, `/api/restaurants/*`, `/api/reviews/*`, `/api/orders/*`, `/api/qr/*` | tourism-service | 3002 |

Configuration clé :
- `bodyParser: false` pour permettre au proxy middleware de transmettre les corps bruts.
- `pathRewrite: (path) => path.replace(/^\/api/, '')` pour retirer `/api` avant d’envoyer aux services.
- `enableCors` configuré pour autoriser `http://localhost:3102`.
- Fichier `.env` créé dans chaque service avec `DATABASE_URL` pointant sur MongoDB Atlas.

---

## 4. Frontend `tourism-app`

### 4.1 Pages

| Route | Description |
|-------|-------------|
| `/:locale` | Page d’accueil |
| `/:locale/login` | Formulaire de connexion |
| `/:locale/hotels` | Liste des hôtels |
| `/:locale/hotels/:id` | Détail hôtel |
| `/:locale/hotels/:id/book` | Formulaire de réservation |
| `/:locale/bookings` | Mes réservations |
| `/:locale/bookings/:id/qr` | QR code d’une réservation |
| `/:locale/admin` | Dashboard admin |
| `/:locale/admin/hotels` | Gestion des hôtels |
| `/:locale/admin/bookings` | Gestion des réservations |
| `/:locale/admin/users` | Gestion des utilisateurs |
| `/:locale/admin/settings` | Paramètres admin |
| `/:locale/admin/scan` | Scanner QR pour check-in |

### 4.2 Composants principaux

- `LoginForm.tsx` – formulaire de connexion
- `ClientLayout.tsx` / `Providers.tsx` – layout client et providers
- `Navbar.tsx` – navigation avec langue / auth
- `BookingForm.tsx`, `BookingsList.tsx`, `BookingCard.tsx` – réservations
- `BookingQr.tsx` – affichage QR
- `QrScanner.tsx` – scanner QR
- `AdminLayout.tsx` – sidebar admin + garde rôles
- `AdminHotels.tsx`, `AdminBookings.tsx`, `AdminUsers.tsx`, `AdminSettings.tsx` – panneaux admin

### 4.3 Sécurité frontend

- `useAuth()` context stocke token + utilisateur dans `localStorage`.
- `apiClient` ajoute automatiquement le `Bearer` token.
- `AdminLayout` redirige vers `/login` si non authentifié, ou vers `/` si le rôle n’est pas autorisé.
- Rôles autorisés pour l’admin : `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`.

### 4.4 Internationalisation

- Package `@smartcity/i18n` avec locales `ar`, `fr`, `en`.
- Middleware Next.js qui redirige vers `/:locale` si aucune locale n’est présente.
- Détection RTL pour l’arabe.

---

## 5. Modèle de données (Prisma – MongoDB)

Entités principales :

- `User` – rôles : `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, `GUEST`
- `Tenant` – établissement (hôtel, riad, resort…)
- `Hotel`
- `Room`
- `Booking` – avec champ `qrCode`
- `ServiceOrder` (orders)
- `Review`
- `Activity`
- `Restaurant`
- `Session`

---

## 6. Identifiants de test (seed)

Lancé automatiquement par `prisma db seed` :

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| `admin@smartcity.ma` | `Admin123!` | `SUPER_ADMIN` |
| `manager@smartcity.ma` | `Manager123!` | `MANAGER` |
| `guest@smartcity.ma` | `Guest123!` | `GUEST` |

> Note : les mots de passe sont hashés avec `bcrypt` (12 rounds).

---

## 7. Démarrage local

### 7.1 Prérequis

- Node.js >= 20
- pnpm 9.15.0
- MongoDB Atlas (URI fournie dans `.env`)
- Redis en local (ou via Docker)

### 7.2 Variables d’environnement

Copier `.env.example` en `.env` à la racine et dans chaque service (`services/user-service`, `services/tourism-service`, `services/gateway`). La base de données actuellement configurée est :

```env
DATABASE_URL="mongodb+srv://smartcityio:w5WyzPl1BkdZ66X9@cluster0.jgzxinu.mongodb.net/smartcity?appName=Cluster0"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-jwt-secret-change-in-production"
JWT_REFRESH_SECRET="dev-jwt-refresh-secret-change-in-production"
CORS_ORIGINS="http://localhost:3100,http://localhost:3101,http://localhost:3102"
```

> **Important** : les JWT secrets doivent être **identiques** dans `user-service` et `tourism-service` pour que les tokens soient acceptés par tous les microservices.

### 7.3 Démarrage rapide

```bash
# 1. Installer les dépendances
pnpm install

# 2. Lancer Redis (Docker)
docker-compose up -d redis

# 3. Générer le client Prisma et seed sur Atlas
cd packages/database
npx prisma generate
npx prisma db push --accept-data-loss
node prisma/seed-no-tx.js

# 4. Construire et démarrer les services backend
cd services/user-service
npx nest build --webpack && node dist/main.js

cd services/tourism-service
npx nest build --webpack && node dist/main.js

cd services/gateway
npx nest build --webpack && node dist/main.js

# 5. Démarrer le frontend
cd apps/tourism-app
pnpm dev
```

URLs :

- Frontend : http://localhost:3102/fr/login
- Gateway API : http://localhost:3000/api
- User service direct : http://localhost:3001
- Tourism service direct : http://localhost:3002

### 7.4 Commandes utiles

```bash
# Tout construire
pnpm build

# Mode dev avec Turbo
turbo run dev

# Formater le code
pnpm format
```

---

## 8. Endpoints API principaux

### Auth (gateway)

| Méthode | Endpoint | Description | Public |
|---------|----------|-------------|--------|
| POST | `/api/auth/login` | Connexion | Oui |
| POST | `/api/auth/register` | Inscription | Oui |
| POST | `/api/auth/refresh` | Refresh token | Oui |
| POST | `/api/auth/logout` | Déconnexion | Non |
| POST | `/api/auth/forgot-password` | Mot de passe oublié | Oui |
| POST | `/api/auth/reset-password` | Réinitialisation | Oui |

### Users

| Méthode | Endpoint | Description | Rôles |
|---------|----------|-------------|-------|
| GET | `/api/users` | Liste utilisateurs | ADMIN+ |
| GET | `/api/users/:id` | Détail | ADMIN+ |
| POST | `/api/users` | Créer | ADMIN+ |
| PATCH | `/api/users/:id` | Modifier | ADMIN+ |
| DELETE | `/api/users/:id` | Supprimer | ADMIN+ |

### Tourism

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/api/hotels` | Liste / créer hôtels |
| GET/PUT/DELETE | `/api/hotels/:id` | Détail / modifier / supprimer |
| GET/POST | `/api/rooms` | Chambres |
| GET/POST | `/api/bookings` | Réservations |
| PATCH | `/api/bookings/:id/status` | Changer statut |
| GET/POST | `/api/activities` | Activités |
| GET/POST | `/api/restaurants` | Restaurants |
| GET/POST | `/api/reviews` | Avis |
| GET/POST | `/api/orders` | Commandes |
| POST | `/api/qr/generate` | Générer QR |
| POST | `/api/qr/validate` | Valider QR check-in |
| GET | `/api/qr/:bookingId` | Récupérer QR |

---

## 9. Points de sécurité mis en place

- Mots de passe hashés avec `bcrypt` (remplacement du SHA-256 initial).
- `JWT_SECRET` obligatoire via `ConfigService.getOrThrow`.
- Tous les endpoints sensibles protégés par JWT + rôles.
- `@Public()` sur les routes auth pour permettre l’accès anonyme.
- CORS restreint aux origines locales connues.
- Body parsing désactivé au gateway pour un proxy fiable.

---

## 10. Changements récents notables

- Connexion à **MongoDB Atlas** remplaçant la base locale en mémoire.
- Création de fichiers `.env` dans `services/user-service`, `services/tourism-service` et `services/gateway` avec l’URI Atlas et les secrets JWT synchronisés.
- Correction du proxy gateway : application du middleware à toutes les routes (`path: '*'`).
- Ajout du support `SUPER_ADMIN` dans `AdminLayout.tsx` et dans les `RolesGuard` des deux microservices.
- Correction de `getMe` dans `user-service` pour utiliser `req.user.userId`.
- Correction des dépendances `useEffect` dans `AdminHotels.tsx`, `AdminBookings.tsx` et `AdminUsers.tsx` pour éviter les boucles infinies de rendu.
- Mise à jour de `next.config.js` pour exposer `NEXT_PUBLIC_API_URL`.
- Build des services backend via `nest build --webpack` (single `dist/main.js`).

---

## 11. Fichiers clés modifiés / créés

- `services/gateway/src/main.ts`
- `services/gateway/src/proxy/proxy.module.ts`
- `services/user-service/src/auth/roles.guard.ts`
- `services/user-service/src/users/users.controller.ts`
- `services/tourism-service/src/auth/roles.guard.ts`
- `apps/tourism-app/src/components/AdminHotels.tsx`
- `apps/tourism-app/src/components/AdminBookings.tsx`
- `apps/tourism-app/src/components/AdminUsers.tsx`
- `apps/tourism-app/next.config.js`
- `services/user-service/.env`
- `services/tourism-service/.env`
- `services/gateway/.env`
- `packages/database/.env`
- `.env.example`

---

## 12. Test rapide

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartcity.ma","password":"Admin123!"}'
```

Réponse attendue :

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "admin@smartcity.ma",
    "firstName": "Youssef",
    "lastName": "El Amrani",
    "role": "SUPER_ADMIN"
  }
}
```

---

**Dernière mise à jour** : test du login UI validé sur `http://localhost:3102/fr/login` avec redirection vers `/fr/admin` pour le rôle `SUPER_ADMIN`.
