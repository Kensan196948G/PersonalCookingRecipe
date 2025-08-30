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
  Api as ApiIcon,
  Notifications as NotificationIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ApiConfigSection } from '@/components/Settings/ApiConfigSection';
import { MonitoringSection } from '@/components/Settings/MonitoringSection';
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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
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
      <Container maxWidth="lg" sx={{ py: 3 }}>
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
            Settings
          </Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box mb={4}>
          <Typography variant="h3" component="h1" gutterBottom>
            System Settings
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Configure API connections, monitoring, and system preferences
          </Typography>
        </Box>

        {/* Settings Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              icon={<ApiIcon />}
              label="API Configuration"
              iconPosition="start"
            />
            <Tab
              icon={<NotificationIcon />}
              label="Monitoring"
              iconPosition="start"
            />
            <Tab
              icon={<StorageIcon />}
              label="Data & Storage"
              iconPosition="start"
            />
            <Tab
              icon={<SecurityIcon />}
              label="Security"
              iconPosition="start"
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <ApiConfigSection />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <MonitoringSection />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Data & Storage Settings
              </Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                Data management features will be available in the next update.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Configure data retention policies, export formats, and storage locations.
              </Typography>
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Security Settings
              </Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                Security configuration features will be available in the next update.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Configure authentication, access controls, and security policies.
              </Typography>
            </Box>
          </TabPanel>
        </Paper>
      </Container>
    </ErrorBoundary>
  );
};