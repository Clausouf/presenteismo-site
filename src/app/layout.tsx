import React from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/context/auth-context';
import { LayoutWrapper } from '@/components/layout-wrapper';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sistema de Presenteísmo T&D e R&S',
  description: 'Controle de frequência, absenteísmo e turnover corporativo.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900">
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
