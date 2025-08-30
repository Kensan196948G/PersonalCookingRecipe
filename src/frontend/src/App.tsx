import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Theme
import { theme } from '@/utils/theme';

// Components
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { CustomAppBar } from '@/components/Layout/AppBar';

// Pages
import { Dashboard } from '@/pages/Home/Dashboard';
import { RecipeDetailPage } from '@/pages/Recipe/RecipeDetailPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';
import { AdminPage } from '@/pages/Admin/AdminPage';

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// Request notification permission on app start
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Register service worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              {/* App Bar */}
              <CustomAppBar />
              
              {/* Main Content */}
              <Box component="main" sx={{ flexGrow: 1, backgroundColor: 'background.default' }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/recipe/:id" element={<RecipeDetailPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  
                  {/* Catch all route - redirect to dashboard */}
                  <Route path="*" element={<Dashboard />} />
                </Routes>
              </Box>
            </Box>
          </Router>
        </ThemeProvider>
        
        {/* React Query DevTools (development only) */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;