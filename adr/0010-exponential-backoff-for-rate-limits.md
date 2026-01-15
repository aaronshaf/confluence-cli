# ADR 0010: Exponential Backoff for Rate Limits

## Status

Accepted

## Context

Confluence Cloud API has rate limits. Need a strategy for handling 429 (Too Many Requests) responses.

Options:
1. **Fail immediately** - Report error to user
2. **Fixed delay** - Wait fixed time, retry
3. **Exponential backoff** - Increasing delays with jitter

## Decision

Use exponential backoff with jitter for rate limit handling.

## Rationale

- **Polite client**: Reduces server load during congestion
- **Eventually succeeds**: Temporary limits resolve over time
- **Jitter prevents thundering herd**: Randomization spreads retries
- **Industry standard**: Common practice for API clients
- **Effect integration**: Effect's Schedule API makes this clean

## Implementation

### Retry Strategy
```typescript
import { Effect, Schedule } from 'effect';

const retrySchedule = Schedule.exponential('1 second', 2).pipe(
  Schedule.jittered,
  Schedule.whileInput((error: ApiError) => error.status === 429),
  Schedule.recurUpTo(5) // Max 5 retries
);

// Usage
const fetchWithRetry = (url: string) =>
  pipe(
    fetchPage(url),
    Effect.retry(retrySchedule)
  );
```

### Retry Delays
| Attempt | Base Delay | With Jitter (approx) |
|---------|------------|---------------------|
| 1 | 1s | 0.5-1.5s |
| 2 | 2s | 1-3s |
| 3 | 4s | 2-6s |
| 4 | 8s | 4-12s |
| 5 | 16s | 8-24s |

### Error Types
```typescript
class RateLimitError extends ApiError {
  readonly _tag = 'RateLimitError';

  constructor(
    message: string,
    public readonly retryAfter?: number, // From Retry-After header
  ) {
    super(message, 429);
  }
}
```

### Respecting Retry-After Header
```typescript
const handleRateLimit = (response: Response): Effect<never, RateLimitError> => {
  const retryAfter = response.headers.get('Retry-After');
  const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

  return Effect.fail(new RateLimitError(
    'Rate limited by Confluence API',
    delay
  ));
};
```

## Consequences

### Positive
- Graceful handling of temporary limits
- Better user experience (sync completes eventually)
- Respects server Retry-After hints
- Prevents overwhelming the API

### Negative
- Sync can take longer during rate limiting
- User may need to wait unexpectedly
- Needs clear progress indication

## User Feedback

During retry:
```
⠋ Syncing pages... (rate limited, retrying in 4s)
```

After max retries:
```
✗ Sync failed: Rate limited after 5 retries. Try again later.
```
