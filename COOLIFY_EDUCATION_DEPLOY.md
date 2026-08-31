# Coolify Deployment Guide – ArwaEduc (Education) via Nixpacks

Ce guide déploie **ArwaEduc** (`apps/education-apps`) comme deux nouvelles ressources
Coolify **dans le même projet/écosystème que `tourism-app`** (voir
[COOLIFY_NIXPACKS_DEPLOY.md](./COOLIFY_NIXPACKS_DEPLOY.md)), pas comme un projet séparé.
Même repo GitHub (`bestqrov/smartcity`), même serveur Coolify, même style Nixpacks.

---

## 0. Ce qui existe déjà (vérifié dans le code, pas supposé)

- `apps/education-apps` (backend Express + Prisma/MongoDB) et
  `apps/education-apps/frontend` (Next.js) sont **deux apps séparées**, pas un monolithe —
  donc **deux ressources Coolify**, comme `gateway`/`tourism-app`.
- Le frontend proxy déjà `/api/*` vers le backend en interne
  (`apps/education-apps/frontend/next.config.js`, fonction `rewrites()`), via la variable
  `INTERNAL_API_URL` — exactement le même pattern que `USER_SERVICE_URL`/`TOURISM_SERVICE_URL`
  pour `gateway`. Donc **pas besoin de domaine public pour le backend**, seul le frontend a
  besoin d'un domaine.
- `apps/education-apps/frontend/.env.production` a déjà `NEXT_PUBLIC_API_URL=/api` (relatif) —
  cohérent avec le proxy interne ci-dessus. Ne pas le changer.
- Le domaine de production visé est `https://appinjahi.techmar.cloud` (référencé en dur comme
  fallback dans `src/config/env.ts` et dans plusieurs redirections frontend en cas de session
  expirée) — confirmez avec l'équipe si ce domaine est bien celui à pointer vers ce nouveau
  déploiement Coolify, ou si c'est un ancien hébergement à migrer/retirer après coup.
- La base de données utilise **le même cluster MongoDB Atlas partagé que le reste de
  smartcity**, mais une base isolée : le commentaire dans `apps/education-apps/.env` dit
  explicitement *"smartcity's shared Atlas cluster, isolated 'arwaeduc' database (separate
  from 'smartcity' to avoid colliding with education-service's own collections)"*. Réutilisez
  ce cluster, ne créez pas un cluster Atlas séparé pour ArwaEduc.

⚠️ **Le schéma Prisma de `School` a déjà été poussé** (`npx prisma db push`) sur la
`DATABASE_URL` configurée dans `apps/education-apps/.env` local lors du développement de la
fonctionnalité de démo 15 jours. Si cette URL pointe vers le même cluster Atlas que la
production, la base de prod a déjà les nouveaux champs (`director`, `city`, `address`, `phone`,
`email`, `logo`, `trialEndsAt`) — c'est un ajout de champs optionnels, donc rétro-compatible
avec l'ancien code encore en ligne. Vérifiez juste que ce n'est pas passé sur un cluster de
dev isolé par erreur avant de déployer.

✅ **Port du frontend** : `apps/education-apps/frontend/package.json` a été corrigé en
`"start": "next start -p ${PORT:-3001}"` — Coolify (Nixpacks) injecte `$PORT`, qui prime ; en
local sans `$PORT` défini ça retombe sur `3001` comme avant, donc aucun changement pour le dev.

---

## 1. Prérequis

- Accès à l'instance Coolify déjà utilisée pour `tourism-app`/`gateway` (même projet).
- Le repo `bestqrov/smartcity` déjà connecté (GitHub App déjà installée, voir
  COOLIFY_NIXPACKS_DEPLOY.md section 5 — pas besoin de le refaire).
- La `DATABASE_URL` Atlas confirmée (cluster partagé, base `arwaeduc`).
- Un sous-domaine pointant vers le VPS pour le frontend, par ex. `education.tondomaine.com`
  ou le domaine existant `appinjahi.techmar.cloud` si c'est celui à réutiliser (voir §0).

---

## 2. Déployer `education-backend`

### 2.1 Créer la ressource

1. Dans le même projet Coolify que `tourism-app`/`gateway` : **Add New Resource** →
   **Public Repository** (ou GitHub App si déjà connectée).
2. `bestqrov/smartcity` → branche `main`.
3. **Base Directory** : `apps/education-apps`.
4. **Build Pack** : `Nixpacks`.
5. **Port** : `3010` (confirmé dans `apps/education-apps/.env` : `PORT=3010`, choisi pour
   éviter la collision avec `gateway` (3000) et `user-service` (3001)).

### 2.2 Variables d'environnement

```env
NODE_ENV=production
PORT=3010
DATABASE_URL=<connection string Atlas, base arwaeduc — voir §0>
JWT_SECRET=<secret long et aléatoire, dédié à ArwaEduc, PAS le même que JWT_SECRET de tourism/user-service>
JWT_EXPIRES_IN=7d
```

> **Important :** ce `JWT_SECRET` doit être cohérent entre `education-backend` et
> `education-frontend` s'il est utilisé côté frontend pour décoder un JWT (vérifiez
> `frontend/store/useAuthStore.ts` si un décodage JWT côté client existe) — mais il **n'a pas
> besoin d'être partagé avec le reste de l'écosystème smartcity** (tourism/user-service), car
> ArwaEduc a son propre système d'auth indépendant (`src/utils/jwt.ts`, `src/middlewares/auth.middleware.ts`).

### 2.3 Build / Start Commands

```bash
# Build
npm install && npm run build

# Start
node dist/server.js
```

(`npm run build` fait déjà `tsc && cd frontend && npm install && npm run build` d'après
`package.json` — si Coolify build les deux ressources séparément comme recommandé ici, ce
build du frontend imbriqué est redondant mais inoffensif ; il sera simplement refait par la
ressource `education-frontend` elle-même.)

### 2.4 Domaine

Aucun domaine public nécessaire — accessible uniquement en interne, comme `user-service`.

---

## 3. Déployer `education-frontend`

### 3.1 Créer la ressource

1. **Add New Resource** → **Public Repository**.
2. `bestqrov/smartcity` → branche `main`.
3. **Base Directory** : `apps/education-apps/frontend`.
4. **Build Pack** : `Nixpacks`.
5. **Port** : choisissez un port libre (ex. `3011`, cohérent avec le port de dev local
   documenté pour ArwaEduc) et déclarez-le dans Coolify — Coolify injectera `$PORT` en
   conséquence si le script `start` a été corrigé comme ci-dessus.

### 3.2 Variables d'environnement

```env
NODE_ENV=production
INTERNAL_API_URL=http://education-backend:3010
```

> `education-backend` ici est le **nom de la ressource Coolify** créée à l'étape 2 — Coolify
> résout ce nom en IP interne sur le même réseau, exactement comme `USER_SERVICE_URL=http://user-service:3001`
> pour `gateway` dans COOLIFY_NIXPACKS_DEPLOY.md §8.

Ne définissez PAS `NEXT_PUBLIC_API_URL` en variable Coolify — `.env.production` du repo la
fixe déjà à `/api` (relatif), ce qui est correct puisque `next.config.js` proxy `/api/*` vers
`INTERNAL_API_URL` côté serveur. La redéfinir en variable d'environnement Coolify risque de
la faire pointer vers une URL absolue incorrecte au build.

### 3.3 Build / Start Commands

```bash
# Build
npm install && npm run build

# Start
npm start
```

### 3.4 Domaine

Dans **Domains**, ajoutez le domaine confirmé à l'étape 1 des prérequis (ex.
`https://appinjahi.techmar.cloud` si c'est celui à réutiliser). Activez **HTTPS** / Let's
Encrypt.

---

## 4. Ordre de déploiement

1. **`education-backend`** d'abord (le frontend en dépend via `INTERNAL_API_URL`).
2. **`education-frontend`** ensuite.

---

## 5. Vérifier le déploiement

```bash
# Health / signup endpoint du backend (interne, via le frontend qui proxy /api)
curl -X POST https://<domaine-frontend>/api/schools/signup \
  -H 'Content-Type: application/json' \
  -d '{"ownerName":"Test","ownerEmail":"deploytest@example.com","password":"password123"}'

# Frontend
curl -I https://<domaine-frontend>
```

Attendu : un `success: true` avec un `token` et un `branch.id` sur le premier appel (nouvelle
école créée avec le signup simplifié 3-champs), `200`/`307` sur le second.

Puis testez manuellement dans le navigateur : `/signup` → `/admin/settings` (profil réel,
pas de localStorage), et si vous avez un compte `SUPER_ADMIN`, `/admin/schools`.

---

## 6. Dépannage

### Le frontend renvoie 404/erreur sur tous les appels `/api/*`

- Vérifiez `INTERNAL_API_URL` : doit correspondre exactement au **nom de ressource Coolify**
  du backend, pas à son domaine public (il n'en a pas).
- Vérifiez que `education-backend` est bien **Running** dans Coolify avant de tester le frontend.

### Le frontend ne démarre pas / healthcheck échoue

- Vérifiez que le port déclaré dans la ressource Coolify correspond à ce que Next.js écoute
  réellement (`$PORT` injecté par Coolify, cf. §0).

### 401/403 après déploiement

- `JWT_SECRET` différent entre un ancien déploiement d'ArwaEduc (si `appinjahi.techmar.cloud`
  pointait déjà ailleurs) et ce nouveau — les anciens tokens/sessions ne seront plus valides,
  ce qui est normal après un changement de secret ou d'infrastructure. Informez les
  utilisateurs existants qu'ils devront se reconnecter.

---

## 7. Récapitulatif

| Ressource | Base Directory | Port | Domaine public |
|---|---|---|---|
| `education-backend` | `apps/education-apps` | 3010 | Aucun (interne) |
| `education-frontend` | `apps/education-apps/frontend` | à définir (ex. 3011) | Oui — domaine ArwaEduc |
