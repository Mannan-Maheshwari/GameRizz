# Gamerizz — Socket.IO Event Contract

Socket.IO handles real-time bidirectional communication between the client and server.

## 1. Connection & Session Authentication
Clients connect to `/` with auth payload:
```javascript
io(SERVER_URL, {
  auth: {
    sessionId: "opaque-session-id",
    sessionSecret: "opaque-session-secret"
  }
})
```

If valid, server binds the socket to the session and emits `session:ready`. If invalid or expired, server emits `session:error` and disconnects the socket.

---

## 2. Event Reference

### 2.1 Session & Connection Events
| Event | Dir | Payload | Description |
|---|---|---|---|
| `session:resume` | C -> S | `{ sessionId, sessionSecret }` | Resume active session |
| `session:ready` | S -> C | `{ sessionId, nickname, status, matchId }` | Session confirmed |
| `session:error` | S -> C | `{ code, message }` | Session invalid |
| `connection:status` | S -> C | `{ status: "connected" \| "reconnecting" }` | Real-time connection status |

### 2.2 Matchmaking Events
| Event | Dir | Payload | Description |
|---|---|---|---|
| `queue:join` | C -> S | `{ gameType: "rps" \| "cricket", clientBlocklist: string[] }` | Join queue with local blocklist |
| `queue:joined` | S -> C | `{ gameType, joinedAt }` | Confirmation of queue position |
| `queue:cancel` | C -> S | `{}` | Leave the current queue |
| `queue:cancelled` | S -> C | `{ success: true }` | Cancellation confirmed |
| `queue:status` | S -> C | `{ status: "waiting", queueLength: number }` | Queue heartbeat |
| `queue:switch-offer`| S -> C | `{ proposedGame: "rps" \| "cricket", availableWaiters: number }` | Suggests queue with active players |
| `queue:switch-respond`| C -> S | `{ accept: boolean }` | User accepts or declines switch |
| `queue:switch-result`| S -> C | `{ success: boolean, gameType: string }` | Switch outcome |
| `match:found` | S -> C | `{ matchId, gameType, opponentNickname }` | Match made, transitioning |
| `match:ready` | S -> C | `{ matchId, gameType, gameState }` | Full game state synchronized |
| `match:skip` | C -> S | `{ matchId }` | User skips current stranger |
| `match:leave` | C -> S | `{ matchId }` | User leaves match and returns to lobby |
| `match:ended` | S -> C | `{ matchId, reason, winnerNickname }` | Match terminated |

### 2.3 Chat & Reaction Events
| Event | Dir | Payload | Description |
|---|---|---|---|
| `chat:send` | C -> S | `{ matchId, text: string }` | Send text message (max 500 chars) |
| `chat:message` | S -> C | `{ id, senderNickname, text, timestamp }` | Delivered message in match |
| `chat:reaction-send`| C -> S | `{ matchId, reaction: "👍" \| "😂" \| "🎉" \| "😮" }` | Send reaction |
| `chat:reaction` | S -> C | `{ senderNickname, reaction, timestamp }` | Delivered reaction |
| `chat:error` | S -> C | `{ code: "RATE_LIMITED" \| "INVALID_PAYLOAD", message }` | Chat rejected |

### 2.4 Rock Paper Scissors Events
| Event | Dir | Payload | Description |
|---|---|---|---|
| `rps:move` | C -> S | `{ matchId, move: "rock" \| "paper" \| "scissors" }` | Private move submission |
| `rps:move-accepted` | S -> C | `{ round: number }` | Server confirms move received |
| `rps:round-result` | S -> C | `{ round, moves: { [player]: move }, winner: nickname \| null, scores }` | Moves revealed, scores updated |
| `rps:state` | S -> C | `{ round, scores, myMoveSubmitted: boolean, timeoutAt }` | State sync |

### 2.5 Hand Cricket Events
| Event | Dir | Payload | Description |
|---|---|---|---|
| `cricket:toss-choice`| C -> S | `{ matchId, call: "odd" \| "even", number: 1..6 }` | Submit toss choice & number |
| `cricket:toss-result`| S -> C | `{ winnerNickname, tossChoice, battingFirstNickname }` | Toss resolved |
| `cricket:delivery` | C -> S | `{ matchId, number: 1..6 }` | Submit delivery choice |
| `cricket:delivery-accepted`| S -> C | `{ deliveryNumber }` | Move acknowledged privately |
| `cricket:delivery-result`| S -> C | `{ deliveryNumber, batterNumber, bowlerNumber, outcome: "runs" \| "wicket", runsAdded, totalRuns, wickets, ballsBowled }` | Delivery resolved |
| `cricket:state` | S -> C | `{ innings: 1 \| 2, target, runs, wickets, overs: "1.2", currentBatter, timeoutAt }` | State sync |
| `cricket:match-result`| S -> C | `{ winnerNickname, margin, isDraw: boolean, superOversPlayed: number }` | Match concluded |

### 2.6 Moderation & Safety Events
| Event | Dir | Payload | Description |
|---|---|---|---|
| `moderation:report`| C -> S | `{ matchId, category, reporterNote }` | Report opponent & terminate match |
| `moderation:report-result`| S -> C | `{ success: boolean, ticketId }` | Report confirmation |
| `moderation:block` | C -> S | `{ opponentSessionId }` | Block opponent |
| `moderation:block-result`| S -> C | `{ success: boolean }` | Block confirmation |
