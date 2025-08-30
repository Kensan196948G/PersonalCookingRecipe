import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  LinearProgress,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  YouTube as YouTubeIcon,
  Storage as NotionIcon,
  Restaurant as TastyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Test as TestIcon,
} from '@mui/icons-material';
import { ApiConfig } from '@/types';
import { useApiConfig } from '@/hooks/useSystem';

interface ApiConfigSectionProps {
  onConfigChange?: (config: Partial<ApiConfig>) => void;
}

export const ApiConfigSection: React.FC<ApiConfigSectionProps> = ({
  onConfigChange,
}) => {
  const { 
    config, 
    isLoading, 
    error, 
    updateConfig, 
    isUpdating,
    testConnection,
    isTesting,
    testResult,
  } = useApiConfig();

  const [showSecrets, setShowSecrets] = useState({
    youtube: false,
    notion: false,
    tasty: false,
  });

  const [formData, setFormData] = useState<ApiConfig>({
    youtube: {
      apiKey: '',
      maxResults: 50,
      quotaLimit: 10000,
    },
    notion: {
      token: '',
      databaseId: '',
      pageSize: 100,
    },
    tasty: {
      apiHost: 'tasty.p.rapidapi.com',
      apiKey: '',
      rateLimit: 500,
    },
  });

  React.useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleInputChange = (
    service: keyof ApiConfig,
    field: string,
    value: string | number
  ) => {
    setFormData(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        [field]: value,
      },
    }));
  };

  const handleSave = (service: keyof ApiConfig) => {
    const serviceConfig = { [service]: formData[service] };
    updateConfig(serviceConfig);
    onConfigChange?.(serviceConfig);
  };

  const handleTest = (service: keyof ApiConfig) => {
    testConnection(service);
  };

  const toggleVisibility = (service: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({
      ...prev,
      [service]: !prev[service],
    }));
  };

  const maskSecret = (secret: string, visible: boolean) => {
    if (!secret) return '';
    if (visible) return secret;
    return '*'.repeat(Math.min(secret.length, 20));
  };

  const getConnectionStatus = (service: keyof ApiConfig) => {
    // This would come from system status in real implementation
    return 'connected'; // 'connected' | 'error' | 'unknown'
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading API configuration...
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        API Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure API keys and settings for recipe monitoring services
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load configuration: {error.message}
        </Alert>
      )}

      {/* YouTube API */}
      <Accordion defaultExpanded sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={2}>
            <YouTubeIcon color="error" />
            <Typography variant="h6">YouTube Data API</Typography>
            <Chip
              label={getConnectionStatus('youtube')}
              color={getStatusColor(getConnectionStatus('youtube')) as any}
              size="small"
              icon={getConnectionStatus('youtube') === 'connected' ? <CheckIcon /> : <ErrorIcon />}
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Key"
                type={showSecrets.youtube ? 'text' : 'password'}
                value={maskSecret(formData.youtube.apiKey, showSecrets.youtube)}
                onChange={(e) => handleInputChange('youtube', 'apiKey', e.target.value)}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => toggleVisibility('youtube')}
                      edge="end"
                    >
                      {showSecrets.youtube ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  ),
                }}
                helperText="YouTube Data API v3 key from Google Cloud Console"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Results per Request"
                type="number"
                value={formData.youtube.maxResults}
                onChange={(e) => handleInputChange('youtube', 'maxResults', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 50 }}
                helperText="1-50 results per API call"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Daily Quota Limit"
                type="number"
                value={formData.youtube.quotaLimit}
                onChange={(e) => handleInputChange('youtube', 'quotaLimit', parseInt(e.target.value))}
                helperText="Daily API quota units"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  onClick={() => handleSave('youtube')}
                  disabled={isUpdating}
                >
                  Save YouTube Config
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTest('youtube')}
                  disabled={isTesting}
                  startIcon={<TestIcon />}
                >
                  Test Connection
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Notion API */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={2}>
            <NotionIcon color="action" />
            <Typography variant="h6">Notion Integration</Typography>
            <Chip
              label={getConnectionStatus('notion')}
              color={getStatusColor(getConnectionStatus('notion')) as any}
              size="small"
              icon={getConnectionStatus('notion') === 'connected' ? <CheckIcon /> : <ErrorIcon />}
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Integration Token"
                type={showSecrets.notion ? 'text' : 'password'}
                value={maskSecret(formData.notion.token, showSecrets.notion)}
                onChange={(e) => handleInputChange('notion', 'token', e.target.value)}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => toggleVisibility('notion')}
                      edge="end"
                    >
                      {showSecrets.notion ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  ),
                }}
                helperText="Internal integration token from Notion"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Database ID"
                value={formData.notion.databaseId}
                onChange={(e) => handleInputChange('notion', 'databaseId', e.target.value)}
                helperText="Notion database ID for storing recipes"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Page Size"
                type="number"
                value={formData.notion.pageSize}
                onChange={(e) => handleInputChange('notion', 'pageSize', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 100 }}
                helperText="Results per page (1-100)"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  onClick={() => handleSave('notion')}
                  disabled={isUpdating}
                >
                  Save Notion Config
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTest('notion')}
                  disabled={isTesting}
                  startIcon={<TestIcon />}
                >
                  Test Connection
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Tasty API */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={2}>
            <TastyIcon color="primary" />
            <Typography variant="h6">Tasty API</Typography>
            <Chip
              label={getConnectionStatus('tasty')}
              color={getStatusColor(getConnectionStatus('tasty')) as any}
              size="small"
              icon={getConnectionStatus('tasty') === 'connected' ? <CheckIcon /> : <ErrorIcon />}
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="API Host"
                value={formData.tasty.apiHost}
                onChange={(e) => handleInputChange('tasty', 'apiHost', e.target.value)}
                helperText="RapidAPI host endpoint"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Rate Limit (requests/day)"
                type="number"
                value={formData.tasty.rateLimit}
                onChange={(e) => handleInputChange('tasty', 'rateLimit', parseInt(e.target.value))}
                helperText="Daily request limit"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Key"
                type={showSecrets.tasty ? 'text' : 'password'}
                value={maskSecret(formData.tasty.apiKey, showSecrets.tasty)}
                onChange={(e) => handleInputChange('tasty', 'apiKey', e.target.value)}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => toggleVisibility('tasty')}
                      edge="end"
                    >
                      {showSecrets.tasty ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  ),
                }}
                helperText="RapidAPI key for Tasty API"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  onClick={() => handleSave('tasty')}
                  disabled={isUpdating}
                >
                  Save Tasty Config
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTest('tasty')}
                  disabled={isTesting}
                  startIcon={<TestIcon />}
                >
                  Test Connection
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Test Results */}
      {testResult && (
        <Alert 
          severity={testResult.data?.connected ? 'success' : 'error'}
          sx={{ mt: 2 }}
        >
          <Typography variant="subtitle2">
            Connection Test Result
          </Typography>
          {testResult.data?.message || 
           (testResult.data?.connected ? 'Connection successful' : 'Connection failed')}
        </Alert>
      )}
    </Box>
  );
};