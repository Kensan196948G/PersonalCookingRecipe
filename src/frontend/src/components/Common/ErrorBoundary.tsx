import React from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Typography,
  Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send error to logging service
      console.error('Production Error:', {
        error: error.message,
        stack: error.stack,
        errorInfo,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            resetError={this.handleReset}
          />
        );
      }

      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          sx={{
            minHeight: '50vh',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Alert
            severity="error"
            icon={<BugReportIcon />}
            sx={{
              maxWidth: 600,
              width: '100%',
              mb: 3,
              textAlign: 'left',
            }}
          >
            <AlertTitle>Something went wrong</AlertTitle>
            <Typography variant="body2" sx={{ mb: 2 }}>
              We apologize for the inconvenience. An unexpected error has occurred.
            </Typography>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                component="pre"
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                {this.state.error.stack}
              </Box>
            )}
          </Alert>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={this.handleReset}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}

export const SimpleErrorFallback: React.FC<{
  error: Error;
  resetError: () => void;
}> = ({ error, resetError }) => (
  <Alert
    severity="error"
    action={
      <Button color="inherit" size="small" onClick={resetError}>
        Retry
      </Button>
    }
    sx={{ m: 2 }}
  >
    <AlertTitle>Error</AlertTitle>
    {error.message}
  </Alert>
);