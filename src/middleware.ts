import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Pega o token de sessão do Supabase direto dos cookies do navegador
  const sessionToken = request.cookies.get('sb-access-token') || request.cookies.get('supabase-auth-token');
  const { pathname } = request.nextUrl;

  // Rota pública (única que não exige login)
  const isPublicRoute = pathname === '/login';

  // Cenário A: Não está logado e tenta acessar qualquer página interna -> Chuta pro Login
  // Isso agora inclui a raiz '/', que antes o matcher ignorava
  if (!sessionToken && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Cenário B: Já está logado e tenta forçar a barra indo pro Login -> Joga pro Dashboard
  if (sessionToken && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Configuração de escopo: Agora cobre todas as rotas corretamente 
// e ignora apenas arquivos estáticos e imagens, evitando erros de carregamento
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
