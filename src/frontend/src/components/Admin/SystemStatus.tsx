import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Alert,
  Button,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  YouTube as YouTubeIcon,
  Storage as NotionIcon,
  Restaurant as TastyIcon,
  Computer as SystemIcon,
  Memory as MemoryIcon,
  Speed as PerformanceIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { SystemStatus as SystemStatusType, SystemError } from '@/types';
import { useSystemStatus, useSystemActions } from '@/hooks/useSystem';
import { formatDistanceToNow } from 'date-fns';

export const SystemStatus: React.FC = () => {
  const { status, isLoading, error, refetch } = useSystemStatus();
  const { clearErrors, isClearing, syncChannels, isSyncing } = useSystemActions();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'online': return 'success';
      case 'error': return 'error';
      case 'warning':
      case 'quota_exceeded':
      case 'rate_limited': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckIcon />;
      case 'error': return <ErrorIcon />;
      default: return <WarningIcon />;
    }
  };

  const formatApiStatus = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'error': return 'Error';
      case 'quota_exceeded': return 'Quota Exceeded';
      case 'rate_limited': return 'Rate Limited';
      case 'unauthorized': return 'Unauthorized';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="body2">Loading system status...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load system status: {error.message}
        </Alert>
      </Paper>
    );
  }

  if (!status) return null;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          System Status
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh Status">
            <IconButton onClick={() => refetch()} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            onClick={syncChannels}
            disabled={isSyncing}
            size="small"
          >
            {isSyncing ? 'Syncing...' : 'Sync Channels'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Overall System Health */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <SystemIcon color={status.isOnline ? 'success' : 'error'} />
                <Typography variant="h6">
                  System Health
                </Typography>
                <Chip
                  label={status.isOnline ? 'Online' : 'Offline'}
                  color={status.isOnline ? 'success' : 'error'}
                  icon={status.isOnline ? <CheckIcon /> : <ErrorIcon />}
                />
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">
                      {status.totalRecipes}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Recipes
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {status.activeChannels}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Channels
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {status.pendingTasks}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Tasks
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="error.main">
                      {status.errors.filter(e => !e.resolved).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Errors
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* API Services Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                API Services
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <YouTubeIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary="YouTube Data API"
                    secondary={`Last checked: ${formatDistanceToNow(new Date(status.lastUpdate))} ago`}
                  />
                  <Chip
                    label={formatApiStatus(status.apiStatus.youtube)}
                    color={getStatusColor(status.apiStatus.youtube) as any}
                    size="small"
                    icon={getStatusIcon(status.apiStatus.youtube)}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <NotionIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Notion Integration"
                    secondary={`Last checked: ${formatDistanceToNow(new Date(status.lastUpdate))} ago`}
                  />
                  <Chip
                    label={formatApiStatus(status.apiStatus.notion)}
                    color={getStatusColor(status.apiStatus.notion) as any}
                    size="small"
                    icon={getStatusIcon(status.apiStatus.notion)}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <TastyIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Tasty API"
                    secondary={`Last checked: ${formatDistanceToNow(new Date(status.lastUpdate))} ago`}
                  />
                  <Chip
                    label={formatApiStatus(status.apiStatus.tasty)}
                    color={getStatusColor(status.apiStatus.tasty) as any}
                    size="small"
                    icon={getStatusIcon(status.apiStatus.tasty)}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* System Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Metrics
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <MemoryIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Memory Usage"
                    secondary="System memory consumption"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Normal
                  </Typography>
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <PerformanceIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Performance"
                    secondary="Overall system performance"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Good
                  </Typography>
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <ScheduleIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Last Update"
                    secondary={formatDistanceToNow(new Date(status.lastUpdate))} ago
                  />
                  <Typography variant="body2" color="text.secondary">
                    Recent
                  </Typography>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Errors */}
        {status.errors.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Recent Errors ({status.errors.filter(e => !e.resolved).length} active)
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={clearErrors}
                    disabled={isClearing}
                  >
                    {isClearing ? 'Clearing...' : 'Clear Resolved'}
                  </Button>
                </Box>
                
                <List dense>
                  {status.errors.slice(0, 5).map((error) => (
                    <ListItem key={error.id}>
                      <ListItemIcon>
                        <ErrorIcon color={error.resolved ? 'disabled' : 'error'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={error.message}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {error.type} • {formatDistanceToNow(new Date(error.timestamp))} ago
                            </Typography>
                            {error.channel && (
                              <Chip
                                label={error.channel}
                                size="small"
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </Box>
                        }
                        sx={{
                          opacity: error.resolved ? 0.6 : 1,
                          textDecoration: error.resolved ? 'line-through' : 'none',
                        }}
                      />
                      {error.resolved && (
                        <Chip
                          label="Resolved"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </ListItem>
                  ))}
                </List>
                
                {status.errors.length > 5 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    ... and {status.errors.length - 5} more errors
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};