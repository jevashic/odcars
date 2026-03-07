

## Diagnosis

The only file calling `check_availability` is `src/pages/booking/SearchResults.tsx` (line 83-88). The RPC call parameters are already correct (`p_exclude_reservation_id: null`).

**The real bug is on line 89 — the response parsing:**

```typescript
availCache[catId] = avail?.available ?? false;
```

The Supabase RPC likely returns the result object directly as `data` (i.e., `data = { available: true, available_count: 3 }`), so `avail?.available` should work. However, if the function returns a **single boolean** or a different structure, `avail?.available` would be `undefined`, causing everything to default to `false` — which matches the reported symptom of "no availability" even when units exist.

## Plan

**File: `src/pages/booking/SearchResults.tsx`** (lines 83-89)

1. Fix the response parsing to handle both possible return shapes:
   - If `avail` is a boolean directly → use it as-is
   - If `avail` is an object with `.available` → use that property
   - Add a `console.log` temporarily to debug the actual shape (remove after confirming)

2. Updated code:
```typescript
const { data: avail } = await supabase.rpc('check_availability', {
  p_category_id: catId,
  p_start_date: sd,
  p_end_date: ed,
  p_exclude_reservation_id: null,
});
// Handle both shapes: direct boolean or { available: boolean }
const isAvail = typeof avail === 'boolean' ? avail : (avail?.available ?? false);
availCache[catId] = isAvail;
```

This is a single-line fix in one file. No other files call `check_availability`.

