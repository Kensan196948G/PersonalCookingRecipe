import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  FormControlLabel,
  Switch,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Test as TestIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { MonitoringConfig } from '@/types';
import { useMonitoringConfig } from '@/hooks/useSystem';

export const MonitoringSection: React.FC = () => {
  const {
    config,
    isLoading,
    error,
    updateConfig,
    isUpdating,
  } = useMonitoringConfig();

  const [formData, setFormData] = useState<MonitoringConfig>({
    checkInterval: 15,
    enableNotifications: true,
    notificationChannels: {
      email: false,
      desktop: true,
      webhook: undefined,
    },
    autoRetry: true,
    maxRetries: 3,
    backoffStrategy: 'exponential',
  });

  const [testDialogOpen, setTestDialogOpen] = useState(false);

  React.useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleInputChange = (field: keyof MonitoringConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNestedInputChange = (
    parent: keyof MonitoringConfig,
    field: string,
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    updateConfig(formData);
  };

  const handleTestNotification = () => {
    setTestDialogOpen(true);
    
    // Test desktop notification
    if (formData.notificationChannels.desktop && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Recipe Monitor Test', {
          body: 'This is a test notification from the recipe monitoring system.',
          icon: '/favicon.ico',
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Recipe Monitor Test', {
              body: 'This is a test notification from the recipe monitoring system.',
              icon: '/favicon.ico',
            });
          }
        });
      }
    }

    setTimeout(() => setTestDialogOpen(false), 2000);
  };

  const formatInterval = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Monitoring Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure recipe monitoring intervals, notifications, and retry behavior
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load monitoring configuration: {error.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Monitoring Intervals */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <ScheduleIcon color="primary" />
              <Typography variant="h6">Monitoring Schedule</Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" gutterBottom>
                  Check Interval: {formatInterval(formData.checkInterval)}
                </Typography>
                <Slider
                  value={formData.checkInterval}
                  onChange={(_, value) => handleInputChange('checkInterval', value as number)}
                  min={5}
                  max={120}
                  step={5}
                  marks={[
                    { value: 5, label: '5min' },
                    { value: 15, label: '15min' },
                    { value: 30, label: '30min' },
                    { value: 60, label: '1h' },
                    { value: 120, label: '2h' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={formatInterval}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Backoff Strategy</InputLabel>
                  <Select
                    value={formData.backoffStrategy}
                    onChange={(e) => handleInputChange('backoffStrategy', e.target.value)}
                    label="Backoff Strategy"
                  >
                    <MenuItem value="linear">Linear</MenuItem>
                    <MenuItem value="exponential">Exponential</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.autoRetry}
                      onChange={(e) => handleInputChange('autoRetry', e.target.checked)}
                    />
                  }
                  label="Auto Retry on Failures"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Max Retries"
                  type="number"
                  value={formData.maxRetries}
                  onChange={(e) => handleInputChange('maxRetries', parseInt(e.target.value))}
                  inputProps={{ min: 0, max: 10 }}
                  disabled={!formData.autoRetry}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <NotificationIcon color="primary" />
              <Typography variant="h6">Notifications</Typography>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enableNotifications}
                      onChange={(e) => handleInputChange('enableNotifications', e.target.checked)}
                    />
                  }
                  label="Enable Notifications"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notificationChannels.desktop}
                      onChange={(e) => 
                        handleNestedInputChange('notificationChannels', 'desktop', e.target.checked)
                      }
                    />
                  }
                  label="Desktop Notifications"
                  disabled={!formData.enableNotifications}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notificationChannels.email}
                      onChange={(e) => 
                        handleNestedInputChange('notificationChannels', 'email', e.target.checked)
                      }
                    />
                  }
                  label="Email Notifications"
                  disabled={!formData.enableNotifications}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Webhook URL (Optional)"
                  value={formData.notificationChannels.webhook || ''}
                  onChange={(e) => 
                    handleNestedInputChange('notificationChannels', 'webhook', e.target.value || undefined)
                  }
                  placeholder="https://your-webhook-url.com/notifications"
                  disabled={!formData.enableNotifications}
                  helperText="Send notifications to a webhook URL (e.g., Slack, Discord)"
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={2}>
                  <Button
                    variant="outlined"
                    onClick={handleTestNotification}
                    startIcon={<TestIcon />}
                    disabled={!formData.enableNotifications}
                  >
                    Test Notifications
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleSave}
              disabled={isUpdating}
              startIcon={<SaveIcon />}
              sx={{ minWidth: 200 }}
            >
              {isUpdating ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)}>
        <DialogTitle>Testing Notifications</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Sending test notifications to configured channels...
          </Typography>
          {formData.notificationChannels.desktop && (
            <Chip
              label="Desktop"
              color="primary"
              size="small"
              sx={{ mt: 2, mr: 1 }}
            />
          )}
          {formData.notificationChannels.email && (
            <Chip
              label="Email"
              color="primary"
              size="small"
              sx={{ mt: 2, mr: 1 }}
            />
          )}
          {formData.notificationChannels.webhook && (
            <Chip
              label="Webhook"
              color="primary"
              size="small"
              sx={{ mt: 2, mr: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};