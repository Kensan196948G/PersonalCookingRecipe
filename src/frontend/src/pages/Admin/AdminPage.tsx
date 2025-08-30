import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Breadcrumbs,
  Link,
  Alert,
} from '@mui/material';
import {
  Dashboard as StatusIcon,
  List as LogsIcon,
  BarChart as StatsIcon,
  Settings as SystemIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { SystemStatus } from '@/components/Admin/SystemStatus';
import { LogViewer } from '@/components/Admin/LogViewer';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleBackToDashboard = () => {
    navigate('/');
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body2"
            onClick={handleBackToDashboard}
            sx={{ textDecoration: 'none' }}
          >
            Dashboard
          </Link>
          <Typography variant="body2" color="text.primary">
            Admin
          </Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box mb={4}>
          <Typography variant="h3" component="h1" gutterBottom>
            System Administration
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Monitor system health, view logs, and manage system operations
          </Typography>
        </Box>

        {/* Admin Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab
              icon={<StatusIcon />}
              label="System Status"
              iconPosition="start"
            />
            <Tab
              icon={<LogsIcon />}
              label="System Logs"
              iconPosition="start"
            />
            <Tab
              icon={<StatsIcon />}
              label="Statistics"
              iconPosition="start"
            />
            <Tab
              icon={<SystemIcon />}
              label="System Tools"
              iconPosition="start"
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <SystemStatus />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <LogViewer />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                System Statistics
              </Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                Detailed statistics dashboard will be available in the next update.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                View detailed analytics, performance metrics, and usage statistics.
              </Typography>
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                System Tools
              </Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                Advanced system management tools will be available in the next update.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Database maintenance, cache management, and system optimization tools.
              </Typography>
            </Box>
          </TabPanel>
        </Paper>
      </Container>
    </ErrorBoundary>
  );
};