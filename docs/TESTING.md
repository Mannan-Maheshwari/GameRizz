# Gamerizz — Testing Strategy & Verification Plan

## 1. Test Layers & Tools

| Level | Tool | Coverage Area |
|---|---|---|
| **Backend Unit Tests** | Vitest / Jest | Nickname validation, RPS resolution, Hand Cricket scoring/overs/target/super-over, rate limiter, ban expiry |
| **Backend Integration Tests**| Supertest + Socket.IO Client | REST API endpoints, socket authentication, queue joins, pair matching, chat delivery, report filing, admin actions |
| **Frontend Unit / Component Tests** | Vitest + Testing Library | Guest setup form, Nickname editing, Game cards, Chat message bubble, RPS buttons, Cricket number pad |
| **Security Tests** | Automated script | XSS injection attempts, rate limit abuse, unauthorized admin calls, session spoofing |

---

## 2. Test Execution Commands

```bash
# Run all tests across workspace
npm test

# Run server unit & integration tests
npm run test:server

# Run client tests
npm run test:client
```

---

## 3. Critical Test Scenarios & Edge Cases

1. **RPS Resolution Matrix:** Rock defeats Scissors, Scissors defeats Paper, Paper defeats Rock, identical moves tie. First to 2 wins takes match.
2. **Cricket Scoring & Dismissals:** Same number = out, different number = runs added to batter. Maximum 18 deliveries per innings. Second innings stops immediately upon chasing target.
3. **Super-Over Tie Resolution:** 1-over super-over if scores are equal. Repeated up to 3 super-overs, resulting in a draw if tied after limit.
4. **Queue Atomic Transitions:** Ensure 2 users entering queue are paired once without race condition or duplicate match creation.
5. **No Cross-Queue Leakage:** Session waiting for Hand Cricket is never forced into Rock Paper Scissors without explicit acceptance.
6. **Report & Moderation:** Report creates exactly one ticket, terminates active match, and places anonymous personal block preventing rematch.
