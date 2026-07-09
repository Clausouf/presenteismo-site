import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Busca qualquer cookie que comece com 'sb-' (o padrão do Supabase para sessões)
  // Isso resolve o problema de o cookie ter um nome variável (hash)
  const sessionCookie = request.cookies.getAll().find(cookie => 
    cookie.name.startsWith('sb-')
  );

  const { pathname } = request.nextUrl;

  // Rota pública (única que não exige login)
  const isPublicRoute = pathname === '/login';

  // Cenário A: Não está logado e tenta acessar qualquer página interna -> Chuta pro Login
  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Cenário B: Já está logado e tenta forçar a barra indo pro Login -> Joga pro Dashboard
  if (sessionCookie && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Se passou pelas verificações, continua o fluxo normal
  return NextResponse.next();
}

// Configuração de escopo: roda em todas as rotas, exceto arquivos estáticos e API
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
