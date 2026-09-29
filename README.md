# Production-Oriented Distributed API Rate Limiter

A scalable, distributed API rate-limiting system built with **NestJS**, **TypeScript**, **Redis**, and **ioredis**. Designed using clean system architecture patterns to handle high-concurrency API environments across multiple application instances.

---

## 🏗️ Architecture & Component Flow

```
                      +-------------------+
                      |   Client Request  |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      |   NestJS API      |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      |  RateLimitGuard   |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      | RateLimiterService|
                      +----+---------+----+
                           |         |
         +-----------------+         +-----------------+
         |                                             |
         v                                             v
+------------------+                          +------------------+
|  Policy Engine   |                          | Strategy Factory |
+--------+---------+                          +--------+---------+
         |                                             |
         v                                             v
 (Resolves policy &                            (Returns Strategy:
  generates Redis key)                         TokenBucketStrategy)
         |                                             |
         +-----------------+---------+-----------------+
                           |
                           v
              +--------------------------+
              | TokenBucketStrategy      |
              | (Executes Atomic Lua)    |
              +------------+-------------+
                           |
                           v
              +--------------------------+
              |   Redis Shared State     |
              +------------+-------------+
                           |
                           v
              +--------------------------+
              |   Allow / Reject (429)   |
              +--------------------------+
```

---

## 🎯 Key Design Decisions & Architectural Concepts

### 1. Strategy Pattern for Algorithms
Rather than bundling rate-limiting logic into giant `if/else` or `switch` blocks, each algorithm (e.g., Token Bucket, Fixed Window, Sliding Window Log) is isolated into its own class implementing the standard `RateLimitStrategy` interface:

```typescript
export interface RateLimitStrategy {
  check(context: RateLimitContext): Promise<RateLimitResult>;
}
```

**Why this design?**
* **Single Responsibility Principle (SRP):** Algorithm mechanics are decoupled from HTTP guards and policy routing.
* **Extensibility:** Adding a new algorithm requires creating a new strategy class and registering it in `StrategyFactory` without modifying existing logic.

### 2. Policy Engine
The `PolicyEngine` determines *which* rate-limiting rules apply to a given request path and context.

* **Policy model:**
  ```json
  {
    "route": "/api/test",
    "algorithm": "TOKEN_BUCKET",
    "limit": 5,
    "windowSeconds": 1,
    "burst": 5
  }
  ```
* **Key Generation Strategy:** Standardized dimension key:
  `rate-limit:{tenantId}:{userId}:{route}`

### 3. Redis Atomicity (Why Lua Scripts are Required)
In a distributed backend with multiple NestJS instances, read-modify-write operations in application code introduce critical **race conditions**:

```
[Instance A] Read tokens (count = 1)  ---┐
                                         |---> Both see 1 token, both allow request!
[Instance B] Read tokens (count = 1)  ---┘     (Limit breached!)
```

To eliminate race conditions, the entire state inspection, refill calculation, token consumption, and TTL update are executed inside a **single atomic Redis Lua script**. Redis executes Lua scripts synchronously on its single-threaded event loop, guaranteeing 100% atomicity across all application instances.

### 4. How Token Bucket Works
The **Token Bucket** algorithm allows bursty traffic up to a maximum capacity while refilling tokens at a continuous rate:

* **Capacity ($C$):** Maximum tokens the bucket can hold (e.g., 5).
* **Refill Rate ($R$):** $limit / windowSeconds$ tokens per second.
* **State stored in Redis Hash (`rate-limit:{tenant}:{user}:{route}`):**
  * `tokens`: current floating-point token balance.
  * `last_refill`: timestamp (milliseconds) of the last evaluation.

#### Mathematical Refill Formula inside Lua:
$$\text{elapsed\_seconds} = \frac{\text{now} - \text{last\_refill}}{1000}$$
$$\text{refilled\_tokens} = \text{elapsed\_seconds} \times \text{refill\_rate}$$
$$\text{new\_tokens} = \min(C, \text{tokens} + \text{refilled\_tokens})$$

If $\text{new\_tokens} \ge 1$: consume 1 token, update state, allow request.  
If $\text{new\_tokens} < 1$: reject request, calculate $\text{retryAfter} = \lceil \frac{1 - \text{new\_tokens}}{\text{refill\_rate}} \rceil$.

---

## ⚡ Error Handling: Fail-Open vs Fail-Closed

When Redis is unreachable or experiences network partitioning, the system follows a configurable strategy defined by `RATE_LIMITER_FAIL_STRATEGY`:

* **`FAIL_OPEN` (Default):** Bypasses rate limiting and allows requests. Prioritizes **High Availability (HA)** over strict rate enforcement.
* **`FAIL_CLOSED`:** Rejects incoming requests with HTTP 429. Prioritizes **Security & Infrastructure Defense** over availability.

---

## 🚀 Quick Start & Setup

### Prerequisites
* Node.js v18+
* Docker & Docker Compose

### 1. Start Redis Container
```bash
docker-compose up -d
```

### 2. Environment Configuration
Copy environment template:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Application
```bash
npm run start:dev
```
The server will start on `http://localhost:3000`.

---

## 🧪 Testing the Implementation

### Run Unit Tests
```bash
npm test
```

### Manual API Test (Token Bucket Behavior)

The endpoint `GET /api/test` is configured with:
* `TOKEN_BUCKET`: capacity = 5, refill rate = 1 token/sec.

#### 1. Fire 5 Rapid Requests (Allowed):
```bash
for i in {1..5}; do curl -i http://localhost:3000/api/test; done
```
* Response: `HTTP 200 OK`
* Headers included:
  * `X-RateLimit-Limit: 5`
  * `X-RateLimit-Remaining: 4, 3, 2, 1, 0`

#### 2. Fire 6th Request (Rejected):
```bash
curl -i http://localhost:3000/api/test
```
* Response: `HTTP 429 Too Many Requests`
* Headers:
  * `X-RateLimit-Limit: 5`
  * `X-RateLimit-Remaining: 0`
  * `Retry-After: 1`

#### 3. Wait 1 Second & Retry (Allowed):
```bash
sleep 1 && curl -i http://localhost:3000/api/test
```
* Response: `HTTP 200 OK` (1 token refilled!)

---

## 📅 Roadmap for Next Phases
* [x] **Phase 1:** NestJS architecture, Redis Lua setup, Policy Engine, Token Bucket strategy, Unit Tests.
* [ ] **Phase 2:** Fixed Window Counter & Sliding Window Counter.
* [ ] **Phase 3:** Sliding Window Log & Leaky Bucket.
* [ ] **Phase 4:** Generic Cell Rate Algorithm (GCRA).
* [ ] **Phase 5:** Distributed Load Testing (autocannon) & Capacity Planning.
