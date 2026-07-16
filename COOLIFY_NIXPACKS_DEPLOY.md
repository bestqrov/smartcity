# Coolify Deployment Guide – Nixpacks Setup

Ce guide explique comment déployer la plateforme **Smart City Tourism** sur **Coolify** en utilisant **Nixpacks** (pas Docker Compose). Chaque service est déployé comme une ressource indépendante.

---

## 1. Architecture de déploiement Nixpacks

Avec Nixpacks, chaque service est une ressource Coolify séparée :

| Ressource Coolify | Type | Port | Repo Path |
|-------------------|------|------|-----------|
| `user-service` | Nixpacks | 3001 | `services/user-service` |
| `tourism-service` | Nixpacks | 3002 | `services/tourism-service` |
| `gateway` | Nixpacks | 3000 | `services/gateway` |
| `tourism-app` | Nixpacks Static / Node | 3102 | `apps/tourism-app` |
| `redis` | Service Coolify | 6379 | — |

La base de données utilise **MongoDB Atlas** (recommandé).

---

## 2. Prérequis

- Un VPS Hostinger (Ubuntu 22.04+) avec Coolify installé.
- Un compte GitHub avec accès au repo `bestqrov/smartcity`.
- MongoDB Atlas cluster prêt.
- Un nom de domaine ou sous-domaine.

---

## 3. Configurer MongoDB Atlas

Voir [MONGODB_ATLAS_SETUP.md](./MONGODB_ATLAS_SETUP.md).

Récupérez la connection string :

```env
DATABASE_URL="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smartcity?retryWrites=true&w=majority"
```

---

## 4. Ajouter Redis dans Coolify

1. Créez un nouveau projet dans Coolify.
2. Cliquez sur **Add New Resource**.
3. Choisissez **Redis**.
4. Nommez-le `smartcity-redis`.
5. Sauvegardez l'URL affichée, généralement :

```env
REDIS_URL="redis://default:PASSWORD@smartcity-redis:6379"
```

---

## 5. Variables d'environnement partagées

Dans Coolify, vous pouvez créer un **Shared Environment Variable Group** pour éviter la duplication :

```env
NODE_ENV=production
DATABASE_URL=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smartcity?retryWrites=true&w=majority
REDIS_URL=redis://default:PASSWORD@smartcity-redis:6379
JWT_SECRET=votre-secret-jwt-tres-long
JWT_REFRESH_SECRET=votre-autre-secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
CORS_ORIGINS=https://smartcity.tondomaine.com
FRONTEND_URL=https://smartcity.tondomaine.com
```

Appliquez ce groupe aux 4 ressources.

---

## 6. Déployer `user-service`

### 6.1 Créer la ressource

1. **Add New Resource** → **Public Repository**.
2. Sélectionnez `bestqrov/smartcity`.
3. Branche `main`.
4. **Base Directory** : `services/user-service`.
5. **Build Pack** : `Nixpacks`.
6. **Port** : `3001`.

### 6.2 Variables spécifiques

```env
PORT=3001
```

### 6.3 Build Command (optionnel)

Si Coolify ne détecte pas automatiquement :

```bash
npm install && npm run build
```

### 6.4 Start Command

```bash
node dist/main.js
```

### 6.5 Domaine

Aucun domaine public n'est nécessaire. Le service communique en interne via le réseau Coolify.

---

## 7. Déployer `tourism-service`

### 7.1 Créer la ressource

1. **Add New Resource** → **Public Repository**.
2. `bestqrov/smartcity` → branche `main`.
3. **Base Directory** : `services/tourism-service`.
4. **Build Pack** : `Nixpacks`.
5. **Port** : `3002`.

### 7.2 Variables spécifiques

```env
PORT=3002
```

### 7.3 Build Command

```bash
npm install && npm run build
```

### 7.4 Start Command

```bash
node dist/main.js
```

---

## 8. Déployer `gateway`

### 8.1 Créer la ressource

1. **Add New Resource** → **Public Repository**.
2. `bestqrov/smartcity` → branche `main`.
3. **Base Directory** : `services/gateway`.
4. **Build Pack** : `Nixpacks`.
5. **Port** : `3000`.

### 8.2 Variables spécifiques

```env
PORT=3000
USER_SERVICE_URL=http://user-service:3001
TOURISM_SERVICE_URL=http://tourism-service:3002
```

> Les noms `user-service` et `tourism-service` correspondent aux noms des ressources Coolify. Coolify résout automatiquement ces noms en IPs internes.

### 8.3 Domaine

Dans **Domains**, ajoutez :

```
https://api.tondomaine.com
```

Activez **HTTPS** avec Let's Encrypt.

### 8.4 Build / Start Commands

```bash
# Build
npm install && npm run build

# Start
node dist/main.js
```

---

## 9. Déployer `tourism-app` (frontend)

### 9.1 Créer la ressource

1. **Add New Resource** → **Public Repository**.
2. `bestqrov/smartcity` → branche `main`.
3. **Base Directory** : `apps/tourism-app`.
4. **Build Pack** : `Nixpacks`.
5. **Port** : `3102`.

### 9.2 Variables spécifiques

```env
NEXT_PUBLIC_API_URL=https://api.tondomaine.com/api
```

> **Important :** `NEXT_PUBLIC_API_URL` doit être définie **avant le build** car Next.js l'inline au build time.

### 9.3 Build Command

```bash
npm install && npm run build
```

### 9.4 Start Command

```bash
npm start
```

### 9.5 Domaine

Dans **Domains**, ajoutez :

```
https://smartcity.tondomaine.com
```

Activez **HTTPS** avec Let's Encrypt.

---

## 10. Fichier `nixpacks.toml` (optionnel)

Si Coolify ne détecte pas bien le build, vous pouvez ajouter un fichier `nixpacks.toml` à la racine de chaque service.

### Pour les services NestJS (`services/*/nixpacks.toml`)

```toml
[phases.build]
cmds = ["npm install", "npm run build"]

[phases.setup]
nixPkgs = ["nodejs_20"]

[start]
cmd = "node dist/main.js"
```

### Pour le frontend (`apps/tourism-app/nixpacks.toml`)

```toml
[phases.build]
cmds = ["npm install", "npm run build"]

[phases.setup]
nixPkgs = ["nodejs_20"]

[start]
cmd = "npm start"
```

---

## 11. Ordre de déploiement

1. **Redis** d'abord.
2. **user-service**.
3. **tourism-service**.
4. **gateway** (dépend des deux services).
5. **tourism-app** (dépend du gateway).

---

## 12. Vérifier le déploiement

```bash
# Health gateway
curl https://api.tondomaine.com/api/health

# Liste hôtels
curl https://api.tondomaine.com/api/hotels

# Frontend
curl -I https://smartcity.tondomaine.com
```

---

## 13. Seeder la base de données

Après le déploiement, seed la base Atlas :

```bash
# En local (depuis votre machine)
cd packages/database
DATABASE_URL="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smartcity?retryWrites=true&w=majority" npx prisma db push --accept-data-loss
DATABASE_URL="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smartcity?retryWrites=true&w=majority" node prisma/seed-no-tx.js
```

---

## 14. Débogage

### Voir les logs

Dans Coolify, cliquez sur chaque ressource → **Logs**.

### Erreur 502 Bad Gateway

- Vérifiez que `user-service` et `tourism-service` sont **Running**.
- Vérifiez que `USER_SERVICE_URL` et `TOURISM_SERVICE_URL` utilisent les bons noms de ressources Coolify.

### Erreur 401/403

- Videz le `localStorage` du navigateur.
- Vérifiez que `JWT_SECRET` et `JWT_REFRESH_SECRET` sont identiques dans tous les services.

### Frontend affiche des erreurs API

- Vérifiez que `NEXT_PUBLIC_API_URL` pointe bien vers `https://api.tondomaine.com/api`.
- Vérifiez que le gateway est accessible depuis internet.

---

## 15. Avantages de Nixpacks vs Docker Compose

| Critère | Nixpacks | Docker Compose |
|---------|----------|----------------|
| Facilité | Plus simple | Plus complexe |
| Multi-services | 4 ressources séparées | 1 fichier compose |
| Scalabilité | Chaque service indépendant | Tous liés ensemble |
| Cache build | Rapide | Plus lent |

---

Bonne déploiement avec Nixpacks ! 🚀
