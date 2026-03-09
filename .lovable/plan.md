

## Problem

The back button in `src/pages/booking/Extras.tsx` (line 105) calls `navigate(-1 as any)`. The `useLangNavigate` hook only supports string paths — it prepends a language prefix, so passing `-1` results in navigating to a broken URL like `/es/-1` instead of going back in history.

## Fix

Replace `navigate(-1 as any)` with `useNavigate()` from react-router-dom for the back button, using the standard `nav(-1)` call for browser history navigation. Alternatively, construct the correct previous route URL from the current search params and use `navigate` with that path.

**Simplest approach:** Import `useNavigate` directly from react-router-dom alongside `useLangNavigate`, and use it for the back button:

```tsx
const rawNavigate = useNavigate(); // from react-router-dom
// ...
<button onClick={() => rawNavigate(-1)} ...>
```

One line import change + one line in the click handler.

