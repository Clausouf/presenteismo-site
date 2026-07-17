import { redirect } from 'next/navigation';

export default function DashboardRoot() {
  // Redireciona automaticamente para treinamento
  redirect('/dashboard/treinamento');
}
