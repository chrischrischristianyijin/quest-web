// Simple dev server to support pretty URLs like /login, /signup, /my-space
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Static files root
const clientRoot = path.resolve(__dirname, '../client');

// Serve static assets
app.use(express.static(clientRoot));

// Pretty route → page mapping
const page = (name) => path.join(clientRoot, 'pages', `${name}.html`);

app.get('/login', (_req, res) => res.sendFile(page('login')));
app.get('/signup', (_req, res) => res.sendFile(page('signup')));
app.get('/my-space', (_req, res) => res.sendFile(page('my-space')));

// Stack view routes - serve my-space.html for SPA routing
app.get('/stacks/:id', (_req, res) => res.sendFile(page('my-space')));

// Root → index
app.get('/', (_req, res) => res.sendFile(page('index')));

// Fallback: if user refreshes on a pretty URL that is not mapped, 404 nicely
app.use((req, res) => {
  res.status(404).send(`Not found: ${req.path}`);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dev server running at http://127.0.0.1:${PORT}`);
});


