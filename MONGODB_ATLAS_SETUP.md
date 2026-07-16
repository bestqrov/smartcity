# MongoDB Atlas Setup Guide

Ce guide explique comment créer ou configurer un cluster **MongoDB Atlas** pour la plateforme Smart City.

---

## 1. Créer un compte MongoDB Atlas

1. Allez sur [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Créez un compte (gratuit avec **M0 Sandbox**).
3. Créez un nouvel organisation et un nouveau projet si nécessaire.

---

## 2. Créer un cluster

1. Cliquez sur **Build a Database**.
2. Choisissez **M0 Sandbox (Shared)** pour un environnement gratuit.
3. Sélectionnez une région proche de votre VPS (ex: `Frankfurt` pour l'Europe, `Virginia` pour les États-Unis).
4. Choisissez le nom du cluster, par exemple `smartcity-cluster`.
5. Cliquez sur **Create Cluster**.

La création du cluster prend environ 1 à 3 minutes.

---

## 3. Créer un utilisateur de base de données

1. Dans le panneau de sécurité, cliquez sur **Database Access**.
2. Cliquez sur **Add New Database User**.
3. Choisissez la méthode d'authentification **Password**.
4. Définissez un **username** et un **password** sécurisé.
5. Dans **Database User Privileges**, sélectionnez **Atlas Admin** ou un rôle personnalisé avec `readWrite` sur la base `smartcity`.
6. Cliquez sur **Add User**.

---

## 4. Autoriser les adresses IP (Network Access)

1. Allez dans **Network Access**.
2. Cliquez sur **Add IP Address**.
3. Deux options :
   - **Allow access from anywhere** : `0.0.0.0/0` (pratique pour Coolify/VPS mais moins sécurisé).
   - **Add current IP address** : votre adresse IP locale.
   - **Ajouter l'IP du VPS Hostinger** : récupérez l'IP du VPS et ajoutez-la.

Pour la production avec Coolify, il est recommandé d'ajouter uniquement l'IP du VPS.

---

## 5. Récupérer la chaîne de connexion (connection string)

1. Allez dans **Database → Connect**.
2. Cliquez sur **Connect your application**.
3. Choisissez le driver **Node.js**.
4. Copiez la chaîne de connexion sous cette forme :

```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/smartcity?retryWrites=true&w=majority
```

5. Remplacez `USERNAME` et `PASSWORD` par vos identifiants.
6. Assurez-vous que la base de données à la fin est bien `smartcity`.

---

## 6. Configurer l'application

### 6.1 Local

Dans le fichier `.env` à la racine et dans chaque service (`services/user-service/.env`, `services/tourism-service/.env`, `services/gateway/.env`, `packages/database/.env`) :

```env
DATABASE_URL="mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/smartcity?retryWrites=true&w=majority"
```

### 6.2 Production (Coolify)

Dans les **Environment Variables** du projet Coolify, ajoutez :

```env
DATABASE_URL="mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/smartcity?retryWrites=true&w=majority"
```

---

## 7. Tester la connexion

### 7.1 En local

```bash
cd packages/database
node prisma/test-connection.js
```

Si la connexion est OK, vous verrez :

```
✅ MongoDB connection OK
```

### 7.2 Seed la base de données

```bash
cd packages/database
npx prisma db push --accept-data-loss
node prisma/seed-no-tx.js
```

---

## 8. Résolution des problèmes

### 8.1 `readConcern majority not enabled`

Atlas utilise un replica set par défaut, donc cette erreur ne devrait pas se produire. Si elle persiste :
- Vérifiez que l'URL contient bien `retryWrites=true&w=majority`.
- Assurez-vous d'utiliser un cluster **Replica Set** (M0 ou supérieur).

### 8.2 `Authentication failed`

- Vérifiez le username et le password.
- Assurez-vous que le user a les droits sur la base `smartcity`.

### 8.3 `MongoServerSelectionError: connection timed out`

- Vérifiez que l'IP du VPS ou de votre machine est bien dans **Network Access**.
- Si vous êtes derrière un firewall, ouvrez le port `27017` en sortie.

### 8.4 `ENOTFOUND cluster0.xxxxx.mongodb.net`

- Vérifiez que le nom du cluster est correct.
- Assurez-vous que le cluster est bien actif (statut `IDLE` dans Atlas).

---

## 9. Sécurité recommandée

- Utilisez un mot de passe fort pour le user Atlas.
- Restreignez l'accès IP au maximum (uniquement le VPS en production).
- Activez l'authentification multifacteur (MFA) sur le compte Atlas.
- Activez les backups automatiques (disponible sur les clusters payants).
- Ne stockez jamais `DATABASE_URL` avec le vrai mot de passe dans le repo Git.

---

## 10. Liens utiles

- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [Prisma MongoDB Connector](https://www.prisma.io/docs/concepts/database-connectors/mongodb)
- [Connection String Format](https://www.mongodb.com/docs/manual/reference/connection-string/)
