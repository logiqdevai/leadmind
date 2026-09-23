export function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LAYOUT_STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #f5f6f8; margin: 0; padding: 0; display: flex; min-height: 100vh;
  align-items: center; justify-content: center; color: #1a1d23;
}
.card {
  background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 10px 30px rgba(0,0,0,.06);
  width: 100%; max-width: 400px; padding: 32px;
}
h1 { font-size: 20px; margin: 0 0 4px; }
p.subtitle { color: #667; font-size: 14px; margin: 0 0 24px; }
label { display: block; font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
input[type=email], input[type=password] {
  width: 100%; padding: 10px 12px; border: 1px solid #d7dae0; border-radius: 8px; font-size: 14px;
}
button {
  width: 100%; margin-top: 24px; padding: 11px 12px; border: none; border-radius: 8px;
  background: #111827; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
button.secondary { background: #fff; color: #111827; border: 1px solid #d7dae0; margin-top: 10px; }
.error { background: #fef2f2; color: #b91c1c; font-size: 13px; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; }
.scope-list { list-style: none; padding: 0; margin: 16px 0; }
.scope-list li { font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f1f3; }
.org-option { display: block; border: 1px solid #d7dae0; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; }
.org-option input { margin-right: 8px; }
.meta { font-size: 12px; color: #8a8f98; margin-top: 20px; text-align: center; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)} · Leadmind</title>
<style>${LAYOUT_STYLE}</style>
</head>
<body>
<div class="card">${body}</div>
</body>
</html>`;
}

export function loginPage(opts: {
  uid: string;
  error?: string;
  email?: string;
}): string {
  return layout(
    'Sign in',
    `
<h1>Sign in to Leadmind</h1>
<p class="subtitle">An application is requesting access to your Leadmind account.</p>
${opts.error ? `<div class="error">${escapeHtml(opts.error)}</div>` : ''}
<form method="post" action="/oauth/interaction/${encodeURIComponent(opts.uid)}/login">
  <label for="email">Email</label>
  <input type="email" id="email" name="email" value="${escapeHtml(opts.email)}" required autofocus />
  <label for="password">Password</label>
  <input type="password" id="password" name="password" required />
  <button type="submit">Continue</button>
</form>
<p class="meta">Don't recognize this request? Close this window.</p>`,
  );
}

export function organisationPickerPage(opts: {
  uid: string;
  loginToken: string;
  organisations: { uuid: string; name: string }[];
}): string {
  const options = opts.organisations
    .map(
      (org) => `
  <label class="org-option">
    <input type="radio" name="organisation_uuid" value="${escapeHtml(org.uuid)}" required />
    ${escapeHtml(org.name)}
  </label>`,
    )
    .join('');

  return layout(
    'Choose a workspace',
    `
<h1>Choose a workspace</h1>
<p class="subtitle">Which Leadmind workspace should this application access?</p>
<form method="post" action="/oauth/interaction/${encodeURIComponent(opts.uid)}/select-organisation">
  <input type="hidden" name="login_token" value="${escapeHtml(opts.loginToken)}" />
  ${options}
  <button type="submit">Continue</button>
</form>`,
  );
}

export function consentPage(opts: {
  uid: string;
  clientName: string;
  clientUri?: string;
  organisationName: string;
  scopeDescriptions: string[];
}): string {
  const scopeItems = opts.scopeDescriptions
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('');

  return layout(
    'Authorize access',
    `
<h1>${escapeHtml(opts.clientName)}</h1>
<p class="subtitle">wants to access your <strong>${escapeHtml(opts.organisationName)}</strong> workspace${
      opts.clientUri
        ? ` (<a href="${escapeHtml(opts.clientUri)}" target="_blank" rel="noopener">${escapeHtml(opts.clientUri)}</a>)`
        : ''
    }</p>
<ul class="scope-list">${scopeItems}</ul>
<form method="post" action="/oauth/interaction/${encodeURIComponent(opts.uid)}/confirm">
  <button type="submit">Allow access</button>
</form>
<form method="post" action="/oauth/interaction/${encodeURIComponent(opts.uid)}/abort">
  <button type="submit" class="secondary">Deny</button>
</form>
<p class="meta">You can revoke this at any time from Leadmind Settings → Connected apps.</p>`,
  );
}

export function errorPage(message: string): string {
  return layout(
    'Something went wrong',
    `
<h1>Something went wrong</h1>
<div class="error">${escapeHtml(message)}</div>`,
  );
}
