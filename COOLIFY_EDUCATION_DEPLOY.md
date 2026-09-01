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
- ✅ **`https://appinjahi.techmar.cloud` n'est plus codé en dur.** Ce domaine appartenait à
  l'app **app-injahi originale, dédiée à un seul client**, dont ce code (ArwaEduc) est une
  réutilisation généralisée en produit SaaS multi-écoles — le garder aurait envoyé n'importe
  quelle autre école vers l'app d'un client tiers à chaque expiration de session. Les 3
  redirections absolues (`frontend/store/useAuthStore.ts`, `frontend/lib/api.ts`,
  `frontend/app/admin/settings/page.tsx`) ont été remplacées par `/login` relatif — fonctionne
  quel que soit le domaine choisi. ArwaEduc a besoin de son **propre nouveau domaine**, distinct
  d'`appinjahi.techmar.cloud` (choisissez-en un à l'étape 1 des prérequis).
- La base de données est un **cluster MongoDB Atlas dédié, séparé du reste de smartcity**
  (confirmé — pas le cluster partagé `cluster0.jgzxinu.mongodb.net` mentionné dans un
  commentaire de `.env` local, qui ne sert que pour le dev/tests). Voir §0bis.

## 0bis. Base de données de production — déjà provisionnée

Un cluster Atlas dédié à ArwaEduc a été fourni et est prêt :

- Cluster : `cluster0.mwoi87g.mongodb.net` (dédié, pas partagé avec tourism/user-service).
- Base : `arwaeduc`.
- Schéma Prisma déjà poussé (`npx prisma db push`) — toutes les collections et index existent.
- Vérifié vide (0 school, 0 user, 0 student) avant tout premier déploiement — aucune donnée de
  test n'a été écrite dessus, contrairement à la base de dev partagée qui en contient.

Utilisez cette `DATABASE_URL` (avec le mot de passe fourni séparément, jamais commité) comme
variable d'environnement de la ressource `education-backend` uniquement — **ne la mettez pas
dans `apps/education-apps/.env` local**, pour que le dev quotidien continue à utiliser la base
de dev/test partagée et ne touche jamais aux données réelles.

✅ **Port du frontend** : `apps/education-apps/frontend/package.json` a été corrigé en
`"start": "next start -p ${PORT:-3001}"` — Coolify (Nixpacks) injecte `$PORT`, qui prime ; en
local sans `$PORT` défini ça retombe sur `3001` comme avant, donc aucun changement pour le dev.

---

## 1. Prérequis

- Accès à l'instance Coolify déjà utilisée pour `tourism-app`/`gateway` (même projet).
- Le repo `bestqrov/smartcity` déjà connecté (GitHub App déjà installée, voir
  COOLIFY_NIXPACKS_DEPLOY.md section 5 — pas besoin de le refaire).
- La `DATABASE_URL` Atlas du cluster dédié ArwaEduc, déjà provisionné et vidé (voir §0bis).
- Un **nouveau** sous-domaine pointant vers le VPS pour le frontend, par ex.
  `education.tondomaine.com` ou `app.arwaeduc.com` — PAS `appinjahi.techmar.cloud` (voir §0,
  ce domaine appartient à l'app client dédiée originale, pas au produit ArwaEduc).

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
DATABASE_URL=<connection string du cluster Atlas dédié ArwaEduc, base arwaeduc — voir §0bis>
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

Dans **Domains**, ajoutez le nouveau domaine confirmé à l'étape 1 des prérequis (PAS
`appinjahi.techmar.cloud`, voir §0). Activez **HTTPS** / Let's Encrypt.

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
