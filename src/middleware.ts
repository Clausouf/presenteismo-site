import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Pega o token de sessão do Supabase direto dos cookies do navegador
  const sessionToken = request.cookies.get('sb-access-token') || request.cookies.get('supabase-auth-token');
  const { pathname } = request.nextUrl;

  // Rota pública (única que não exige login)
  const isPublicRoute = pathname === '/login';

  // Cenário A: Não está logado e tenta acessar qualquer página interna -> Chuta pro Login
  if (!sessionToken && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Cenário B: Já está logado e tenta forçar a barra indo pro Login -> Joga pro Dashboard
  if (sessionToken && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Configuração de escopo: o middleware só vai rodar quando o usuário tentar acessar essas rotas
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/cadastro/:path*',
    '/turmas/:path*',
    '/calendario/:path*',
    '/criar-adm/:path*',
    '/login'
  ],
};
