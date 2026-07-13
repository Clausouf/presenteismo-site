import './globals.css';
import ClientLayout from '@/components/client-layout';

export const metadata = {
  title: 'PRESENTEÍSMO | Integração & Treinamento Inicial',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-emerald-500 selection:text-white">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
