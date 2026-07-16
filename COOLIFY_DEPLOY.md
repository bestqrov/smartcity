# Coolify Deployment Guide

Ce guide explique comment déployer la plateforme **Smart City Tourism** sur un VPS Hostinger en utilisant **Coolify** avec le fichier `docker-compose.prod.yml`.

---

## 1. Prérequis

- Un VPS Hostinger (ou autre) avec **Ubuntu 22.04/24.04**.
- Un accès root/SSH au VPS.
- Un compte GitHub avec le repo public/privé : `bestqrov/smartcity`.
- Un nom de domaine (ou sous-domaine) pointant vers le VPS.
- Une base de données **MongoDB Atlas** (recommandée) ou un cluster MongoDB replica set.

---

## 2. Préparer le VPS

### 2.1 Connexion SSH

```bash
ssh root@TON_IP_VPS
```

### 2.2 Mise à jour du système

```bash
apt update && apt upgrade -y
```

### 2.3 Installer les outils de base

```bash
apt install -y curl wget git ufw
```

### 2.4 Configurer le pare-feu (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

---

## 3. Installer Coolify

### 3.1 Lancer le script d'installation officiel

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

L'installation prend quelques minutes.

### 3.2 Accéder au dashboard Coolify

Après l'installation, Coolify expose l'interface web sur le port `8000` :

```
http://TON_IP_VPS:8000
```

> **Note :** Le script affiche un mot de passe temporaire dans le terminal. Conservez-le.

### 3.3 Créer le compte admin

1. Ouvrez `http://TON_IP_VPS:8000` dans le navigateur.
2. Créez le compte administrateur.
3. Ajoutez votre VPS comme **Localhost Server** ou **Remote Server**.

---

## 4. Configurer le domaine et DNS

### 4.1 Créer les enregistrements DNS

Chez Hostinger (ou votre registrar), ajoutez :

| Type | Hôte | Valeur |
|------|------|--------|
| A | `smartcity` | `TON_IP_VPS` |
| A | `api` | `TON_IP_VPS` |
| A | `admin` | `TON_IP_VPS` |

Exemples de domaines finaux :

- Frontend : `https://smartcity.tondomaine.com`
- API Gateway : `https://api.tondomaine.com`

### 4.2 Configurer le domaine dans Coolify

1. Allez dans **Settings → General**.
2. Définissez le domaine principal de l'instance Coolify si besoin.
3. Assurez-vous que le port `443` est ouvert pour Let's Encrypt.

---

## 5. Connecter GitHub à Coolify

### 5.1 Créer une GitHub App privée

1. Dans Coolify, allez dans **Settings → GitHub App**.
2. Cliquez sur **Create GitHub App**.
3. Choisissez les repositories à autoriser : sélectionnez `bestqrov/smartcity`.
4. Installez l'app sur votre compte/organisation.

### 5.2 Vérifier la connexion

1. Allez dans **Projects → Add New Project**.
2. Choisissez **GitHub App** comme source.
3. Vous devriez voir votre repository `smartcity`.

---

## 6. Créer le projet dans Coolify

### 6.1 Nouveau projet Docker Compose

1. Cliquez sur **Add New Resource**.
2. Sélectionnez **Docker Compose**.
3. Choisissez le repository `bestqrov/smartcity`.
4. Sélectionnez la branche `main`.
5. Indiquez le fichier compose : `docker-compose.prod.yml`.

### 6.2 Configuration du build

Coolify détectera automatiquement les services. Vérifiez :

- **Build context** : `.`
- **Compose file** : `docker-compose.prod.yml`

---

## 7. Configurer les variables d'environnement

Dans l'interface Coolify, ouvrez les **Environment Variables** du projet et ajoutez :

```env
# ── General ──────────────────────────────
NODE_ENV=production
PORT_GATEWAY=3000
PORT_USER_SERVICE=3001
PORT_TOURISM_SERVICE=3002

# ── Database ─────────────────────────────
DATABASE_URL=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/smartcity?retryWrites=true&w=majority

# ── Redis ────────────────────────────────
REDIS_URL=redis://redis:6379

# ── JWT ──────────────────────────────────
JWT_SECRET=votre-secret-jwt-tres-long-et-aleatoire-32-caracteres-min
JWT_REFRESH_SECRET=votre-autre-secret-refresh-tres-long
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ── CORS / Frontend ──────────────────────
CORS_ORIGINS=https://smartcity.tondomaine.com
FRONTEND_URL=https://smartcity.tondomaine.com

# ── Service URLs ─────────────────────────
USER_SERVICE_URL=http://user-service:3001
TOURISM_SERVICE_URL=http://tourism-service:3002

# ── Frontend Public API URL ──────────────
NEXT_PUBLIC_API_URL=https://api.tondomaine.com/api
PORT_TOURISM_APP=3102
```

> **⚠️ Important :** `JWT_SECRET` et `JWT_REFRESH_SECRET` doivent être identiques dans tous les services.

---

## 8. Configurer les domaines pour chaque service

Dans Coolify, configurez les domaines publics :

| Service | Domaine | Port interne |
|---------|---------|--------------|
| gateway | `https://api.tondomaine.com` | 3000 |
| tourism-app | `https://smartcity.tondomaine.com` | 3102 |

### 8.1 Pour le Gateway

1. Ouvrez le service **gateway**.
2. Dans **General → Domains**, ajoutez `https://api.tondomaine.com`.
3. Activez **HTTPS** et **Let's Encrypt**.

### 8.2 Pour le Frontend

1. Ouvrez le service **tourism-app**.
2. Dans **General → Domains**, ajoutez `https://smartcity.tondomaine.com`.
3. Activez **HTTPS** et **Let's Encrypt**.

---

## 9. Déployer

### 9.1 Lancer le premier déploiement

1. Cliquez sur **Deploy**.
2. Coolify va builder les images Docker et démarrer les containers.
3. Suivez les logs en direct.

### 9.2 Vérifier les logs

Si un service ne démarre pas :

```bash
# Se connecter au VPS
docker ps
docker logs smartcity-gateway
docker logs smartcity-user-service
docker logs smartcity-tourism-service
docker logs smartcity-tourism-app
```

---

## 10. Seeder la base de données

Après le déploiement, connectez-vous au conteneur **user-service** ou **tourism-service** pour exécuter le seed :

```bash
docker exec -it smartcity-user-service sh
cd /app/packages/database
npx prisma db push --accept-data-loss
node prisma/seed-no-tx.js
exit
```

Ou depuis le VPS directement (si pnpm/npx sont installés) :

```bash
cd /data/coolify/applications/NOM_DU_PROJET/source
cd packages/database
npx prisma db push --accept-data-loss
node prisma/seed-no-tx.js
```

> Le chemin exact dépend du dossier d'installation Coolify (généralement `/data/coolify/`).

---

## 11. Tester le déploiement

### 11.1 Endpoints à vérifier

```bash
# Health check gateway
curl https://api.tondomaine.com/api/health

# Liste des hôtels
curl https://api.tondomaine.com/api/hotels

# Frontend
curl -I https://smartcity.tondomaine.com
```

### 11.2 Se connecter au panel admin

1. Ouvrez `https://smartcity.tondomaine.com/fr/login`.
2. Connectez-vous avec :
   - Email : `admin@smartcity.ma`
   - Mot de passe : `Admin123!`
3. Vérifiez les pages **Hôtels**, **Réservations**, **Utilisateurs**.

---

## 12. Redémarrer / Mettre à jour

### 12.1 Redéploiement après un push

Chaque `git push` sur `main` déclenchera automatiquement un redeploy si le webhook GitHub est activé.

Sinon, cliquez sur **Deploy** dans Coolify.

### 12.2 Redémarrer manuellement

```bash
cd /data/coolify/applications/NOM_DU_PROJET/source
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 13. Dépannage courant

### 13.1 `readConcern majority not enabled`

**Cause :** Base MongoDB non replica set.  
**Fix :** Utilisez MongoDB Atlas ou un vrai replica set MongoDB.

### 13.2 Erreur 401 / 403 sur les appels API

**Cause :** Token expiré ou secrets JWT différents entre services.  
**Fix :** Videz le `localStorage` du navigateur et reconnectez-vous. Vérifiez que `JWT_SECRET` est identique partout.

### 13.3 `Maximum update depth exceeded`

**Cause :** Problème React useEffect.  
**Fix :** Déjà corrigé dans `AdminHotels.tsx`, `AdminBookings.tsx`, `AdminUsers.tsx`.

### 13.4 Le frontend affiche `Internal Server Error`

**Cause :** `NEXT_PUBLIC_API_URL` mal configuré.  
**Fix :** Vérifiez qu'il pointe bien vers `https://api.tondomaine.com/api`.

### 13.5 Images Docker trop lourdes

**Fix :** Les Dockerfiles sont déjà multi-stage. Assurez-vous que `.dockerignore` est pris en compte.

---

## 14. Sécurité recommandée en production

- Changez le mot de passe admin par défaut après le premier login.
- Utilisez des secrets JWT forts (> 64 caractères).
- Activez l'authentification 2FA sur MongoDB Atlas.
- Restreignez l'accès SSH au VPS (clé publique uniquement).
- Gardez les fichiers `.env` hors du repo Git.
- Activez les backups automatiques MongoDB Atlas.

---

## 15. Récapitulatif des fichiers importants

| Fichier | Description |
|---------|-------------|
| `docker-compose.prod.yml` | Stack de production Coolify |
| `infra/docker/service.Dockerfile` | Build générique des microservices NestJS |
| `infra/docker/tourism-app.Dockerfile` | Build du frontend Next.js |
| `.env.example` | Modèle des variables d'environnement |
| `packages/database/prisma/seed-no-tx.js` | Seed de données initiales |

---

Bonne déploiement ! 🚀
