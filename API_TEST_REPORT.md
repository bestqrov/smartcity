# API Test Report

Rapport de test des endpoints API avant déploiement.

Date : 2026-07-16
Environnement : Local (`localhost:3000` gateway)
Base de données : MongoDB Atlas
Services : `user-service:3001`, `tourism-service:3002`, `gateway:3000`

---

## 1. Health Checks

| Endpoint | Résultat |
|----------|----------|
| `GET /api/health` | 200 OK |
| `GET http://localhost:3001/health` | 200 OK |
| `GET http://localhost:3002/health` | 200 OK |

---

## 2. Endpoints Publics

| Endpoint | Résultat | Notes |
|----------|----------|-------|
| `GET /api/hotels` | 200 OK | 3 hôtels retournés |
| `GET /api/hotels/search` | 200 OK | Recherche OK |
| `GET /api/rooms/search` | 200 OK | 9 chambres |
| `GET /api/activities/search` | 200 OK | 9 activités |
| `GET /api/restaurants/search` | 200 OK | 3 restaurants |
| `GET /api/restaurants` | 404 | Endpoint non implémenté, utiliser `/search` |
| `GET /api/activities` | 404 | Endpoint non implémenté, utiliser `/search` |
| `GET /api/rooms` | 404 | Endpoint non implémenté, utiliser `/search` |

---

## 3. Authentification

| Endpoint | Résultat | Notes |
|----------|----------|-------|
| `POST /api/auth/register` | 201 OK | Utilisateur créé avec rôle GUEST |
| `POST /api/auth/login` | 200 OK | Token JWT retourné |

Identifiants admin testés :
- Email : `admin@smartcity.ma`
- Mot de passe : `Admin123!`

---

## 4. Endpoints Protégés (avec JWT admin)

| Endpoint | Résultat | Notes |
|----------|----------|-------|
| `GET /api/users/me` | 200 OK | Profil admin retourné |
| `GET /api/users` | 200 OK | Liste des utilisateurs |
| `GET /api/bookings` | 200 OK | Liste des réservations |
| `PATCH /api/bookings/:id` | 200 OK | Mise à jour OK |
| `POST /api/bookings` | 201 OK | Création OK (avec bonne capacité) |
| `POST /api/reviews` | 201 OK | Avis créé |
| `GET /api/orders` | 200 OK | Liste vide OK |

---

## 5. QR Code

| Endpoint | Résultat | Notes |
|----------|----------|-------|
| `POST /api/qr/generate` | 200 OK | QR généré en base64 |
| `GET /api/qr/:bookingId` | 200 OK | QR récupéré |
| `POST /api/qr/validate` | 200 OK | Check-in OK après correction des dates |

⚠️ La validation nécessite que la date de `checkIn` soit <= aujourd'hui et `checkOut` >= aujourd'hui.

---

## 6. Problèmes identifiés

1. **Routes list simple manquantes** : `GET /api/restaurants`, `GET /api/activities`, `GET /api/rooms` retournent 404.
   - **Impact faible** : les endpoints `/search` fonctionnent et retournent toutes les données.
   - **Fix possible** : ajouter des routes `GET /` dans les contrôleurs.

2. **Création de booking** : nécessite `guestId` explicite et respect de la capacité de la chambre.
   - **Comportement normal** : validation métier.

3. **Création de review** : nécessite `cleanliness`, `service`, `location`, `value` en plus de `rating` et `comment`.
   - **Comportement normal** : validation DTO.

---

## 7. Verdict global

✅ **L'API est fonctionnelle pour le déploiement.**

Les fonctionnalités critiques fonctionnent :
- Health des services
- Listing public des hôtels/chambres/activités/restaurants
- Authentification JWT
- Endpoints protégés admin
- Génération et validation QR

Les 404 sur `/api/restaurants`, `/api/activities`, `/api/rooms` sont mineurs car les endpoints `/search` équivalents sont disponibles.

---

## 8. Commandes utilisées

```bash
# Health
curl http://localhost:3000/api/health
curl http://localhost:3001/health
curl http://localhost:3002/health

# Public
curl http://localhost:3000/api/hotels
curl http://localhost:3000/api/hotels/search
curl http://localhost:3000/api/rooms/search
curl http://localhost:3000/api/activities/search
curl http://localhost:3000/api/restaurants/search

# Auth
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartcity.ma","password":"Admin123!"}'

# Protégé
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```
