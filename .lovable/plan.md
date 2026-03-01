

## Fix: Admin dashboard white screen

### Root cause

Two issues in `AdminAuthContext.tsx`:

1. **Race condition still present**: Both `onAuthStateChange` (line 60-68) and `getSession` (line 71-76) call `verifyRole()` concurrently. The listener also navigates to `/admin` when there's no session (line 65), which can fire before `getSession` resolves.

2. **Silent blank screen on line 96**: `if (!user) return null` renders nothing after loading finishes if `verifyRole` failed. The user sees a permanent white screen with no feedback.

### Changes to `src/contexts/AdminAuthContext.tsx`

1. **`onAuthStateChange`**: Only react to `SIGNED_OUT` — set user to null. Do NOT call `verifyRole` or navigate. Remove the redirect on no-session.

2. **`verifyRole`**: Capture the query `error`. If there's a DB error, log it and do NOT sign out. Add `setLoading(false)` at the end of `verifyRole` itself so it's guaranteed to run in all branches.

3. **Remove `setLoading(false)` from `getSession` callback** — let `verifyRole` handle it internally.

4. **Handle no-session in `getSession`**: Just call `setLoading(false)` without navigating.

5. **Line 96 fallback**: Instead of returning `null`, redirect to `/admin` when `!user` after loading completes — prevents the blank screen.

### Corrected flow

```text
AdminAuthProvider mounts
  |
  v
getSession()
  |-- session exists --> verifyRole()
  |     |-- query OK + valid role --> setUser(), setLoading(false) --> renders dashboard
  |     |-- query OK + no role --> signOut(), setUser(null), setLoading(false) --> redirect to /admin
  |     |-- query ERROR --> console.error, setLoading(false) --> redirect to /admin
  |-- no session --> setLoading(false) --> redirect to /admin
  
onAuthStateChange:
  |-- SIGNED_OUT --> setUser(null)
  |-- anything else --> ignored
```

