export const runtime = 'edge';

import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redireciona automaticamente a raiz do site para o painel de controle seguro
  redirect('/dashboard');
}
