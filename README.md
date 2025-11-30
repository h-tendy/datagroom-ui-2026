This workspace was reset to a client-only React + react-router app.

How to run:

1. Install dependencies:

```powershell
npm install
```

2. Start the dev server (Vite):

```powershell
npm run dev
```

Behavior:
- Visit `/login` to sign in (credentials: `admin` / `password`).
- After login you'll be redirected to `/` (Main Page).
- Click Logout on the Main Page to return to `/login`.


## Theme Customization

All major colors, fonts, and sizing are controlled via CSS variables in `app/theme.module.css`.

- To change the look and feel, edit the variables in `theme.module.css`.
- All sidebar, main content, and login page styles use these variables.
- Example variables: `--color-primary`, `--color-bg`, `--font-family-main`, `--border-radius`, etc.
- Changes are applied instantly across the site.

This setup is explicitly client-only (no SSR).
If your project had prior server rendering, remove or ignore `build/server` artifacts.
