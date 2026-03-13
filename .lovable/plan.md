

## Plan: Replace horizontal logo in header

The user uploaded a new horizontal logo (`LOGO_OLA_HORIZONTAL_PNG-2.png`) to replace the current one used in the Navbar.

### Steps

1. **Copy the uploaded image** to `src/assets/logo-horizontal.png`, overwriting the existing file.

No code changes needed — the Navbar already imports from `@/assets/logo-horizontal.png`, so replacing the file at that path will automatically update the logo everywhere it's used (Navbar, and any other component importing it).

