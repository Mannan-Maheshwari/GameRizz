# Gamerizz — REST API Specification

All API endpoints return JSON. Standard response format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable explanation"
  }
}
```

---

## 1. Public & Guest Endpoints

### 1.1 `GET /api/health`
- **Description:** Basic process liveness probe.
- **Auth:** None
- **Response 200:**
  ```json
  { "success": true, "data": { "status": "ok", "uptime": 124.5 } }
  ```

### 1.2 `GET /api/ready`
- **Description:** Process readiness probe including MongoDB connection status.
- **Auth:** None
- **Response 200 / 503:**
  ```json
  { "success": true, "data": { "status": "ready", "database": "connected" } }
  ```

### 1.3 `GET /api/games`
- **Description:** List of supported game types and their metadata.
- **Auth:** None
- **Response 200:**
  ```json
  {
    "success": true,
    "data": [
      { "id": "rps", "name": "Rock Paper Scissors", "description": "Best of 3 rounds of classic RPS." },
      { "id": "cricket", "name": "Hand Cricket", "description": "3-over innings with classic numbers 1 to 6." }
    ]
  }
  ```

### 1.4 `POST /api/session`
- **Description:** Initialize an anonymous guest session.
- **Auth:** None
- **Request Body:**
  ```json
  {
    "confirmedAdult": true
  }
  ```
- **Response 201:**
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "b48e3a20-8025-47e1-881b-586fc6d66e5f",
      "sessionSecret": "c92fa04...",
      "nickname": "PixelFox482",
      "createdAt": "2026-10-16T15:20:00.000Z"
    }
  }
  ```

### 1.5 `PATCH /api/session/nickname`
- **Description:** Change nickname for the current session.
- **Auth:** Headers: `x-session-id`, `x-session-secret`
- **Request Body:**
  ```json
  {
    "nickname": "CyberKnight"
  }
  ```
- **Response 200:**
  ```json
  {
    "success": true,
    "data": { "nickname": "CyberKnight" }
  }
  ```
- **Error 400:** `INVALID_NICKNAME` (length 3-20, no profanity, alphanumeric/safe chars)
- **Error 409:** `NICKNAME_TAKEN` (nickname is already claimed by an active user)

### 1.6 `GET /api/session/me`
- **Description:** Retrieve current session information.
- **Auth:** Headers: `x-session-id`, `x-session-secret`
- **Response 200:**
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "b48e3a20...",
      "nickname": "CyberKnight",
      "status": "lobby",
      "selectedGame": null,
      "matchId": null
    }
  }
  ```

---

## 2. Moderation & Reporting Endpoints

### 2.1 `POST /api/reports`
- **Description:** File a moderation report against the opponent in an active match.
- **Auth:** Headers: `x-session-id`, `x-session-secret`
- **Request Body:**
  ```json
  {
    "matchId": "m-8931b2",
    "category": "harassment",
    "reporterNote": "Repeated offensive text messages"
  }
  ```
- **Response 201:**
  ```json
  {
    "success": true,
    "data": {
      "ticketId": "tkt-098274",
      "status": "open",
      "message": "Report received. Match terminated and opponent blocked."
    }
  }
  ```

---

## 3. Administrator Endpoints

### 3.1 `POST /api/admin/login`
- **Description:** Authenticate administrator with username and password.
- **Rate Limit:** 5 attempts per 15 minutes per IP.
- **Request Body:**
  ```json
  { "username": "admin", "password": "supersecretpassword" }
  ```
- **Response 200:** Sets secure HttpOnly cookie `admin_token` or returns bearer token.

### 3.2 `POST /api/admin/logout`
- **Description:** Invalidate admin session.

### 3.3 `GET /api/admin/session`
- **Description:** Verify admin authentication status.

### 3.4 `GET /api/admin/reports`
- **Description:** List moderation tickets with filtering (status, category, date).
- **Query Params:** `status`, `category`, `limit`, `page`.

### 3.5 `GET /api/admin/reports/:id`
- **Description:** Retrieve ticket details and associated metadata.

### 3.6 `PATCH /api/admin/reports/:id`
- **Description:** Update ticket status, decision, and internal decision notes.
- **Request Body:**
  ```json
  {
    "status": "action_taken",
    "decision": "temporary_ban",
    "decisionReason": "Severe abusive conduct verified."
  }
  ```

### 3.7 `POST /api/admin/enforcements`
- **Description:** Issue a platform-level enforcement action (ban/cooldown).

### 3.8 `POST /api/admin/enforcements/:id/reverse`
- **Description:** Reverse a platform-level enforcement action.

### 3.9 `GET /api/admin/audit-logs`
- **Description:** Query administrative audit log.
