import { type NextRequest, NextResponse } from 'next/server';

// Lead-owned (security). Two jobs, before any page renders:
// 1. Per-request nonce Content-Security-Policy (D020 follow-up from P1): scripts
//    run only with this request's nonce ('strict-dynamic'), so injected markup
//    cannot execute script. Styles keep 'unsafe-inline' because components set
//    CSS custom properties via style attributes, which nonces cannot authorise.
// 2. Optimistic sign-in redirect for /app/*: only checks the session cookie is
//    present. The API still authorises every request (ADR 0002).

const SESSION_COOKIES = ['funfriday.session_token', '__Secure-funfriday.session_token'];
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1')
  .origin;
// Socket.IO live sessions connect to the same API origin over ws(s). Chromium does not treat an
// http(s) source as covering ws(s), so the WebSocket origin is listed explicitly (P4).
const apiSocketOrigin = apiOrigin.replace(/^http/, 'ws');

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} ${apiSocketOrigin}${isDev ? ' ws://localhost:3000' : ''}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function isAppRoute(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/');
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (isAppRoute(pathname) && !SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/sign-in';
    signIn.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV !== 'production');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
