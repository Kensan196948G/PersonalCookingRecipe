import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { AuthProvider } from '@/hooks/useAuth';
import './globals.css';

// React Query クライアント設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5分
      cacheTime: 10 * 60 * 1000, // 10分
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export const metadata = {
  title: 'Personal Recipe - あなただけのレシピコレクション',
  description: 'あなただけの特別なレシピコレクション。料理の記録、共有、発見を通じて、より豊かな食生活をお手伝いします。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full font-sans antialiased">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}