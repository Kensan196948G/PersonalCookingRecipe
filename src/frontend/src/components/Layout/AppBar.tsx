import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  AccountCircle as AccountIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSystemStatus } from '@/hooks/useSystem';

interface AppBarProps {
  onMenuClick?: () => void;
}

export const CustomAppBar: React.FC<AppBarProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useSystemStatus();
  
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleAccountClick = (event: React.MouseEvent<HTMLElement>) => {
    setAccountAnchor(event.currentTarget);
  };

  const handleClose = () => {
    setNotificationAnchor(null);
    setAccountAnchor(null);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    handleClose();
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Recipe Dashboard';
      case '/settings':
        return 'Settings';
      case '/admin':
        return 'Admin Panel';
      default:
        if (location.pathname.startsWith('/recipe/')) {
          return 'Recipe Details';
        }
        return 'Recipe Monitor';
    }
  };

  const unreadNotifications = status?.errors?.filter(e => !e.resolved).length || 0;

  return (
    <AppBar position="sticky" elevation={1}>
      <Toolbar>
        {/* Menu Button */}
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Logo and Title */}
        <Box display="flex" alignItems="center" sx={{ flexGrow: 1 }}>
          <Avatar
            sx={{ 
              mr: 2, 
              bgcolor: 'secondary.main',
              width: 40,
              height: 40,
            }}
          >
            🍳
          </Avatar>
          
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              Recipe Monitor
            </Typography>
            <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
              {getPageTitle()}
            </Typography>
          </Box>
        </Box>

        {/* Navigation Buttons */}
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            color="inherit"
            startIcon={<HomeIcon />}
            onClick={() => handleNavigate('/')}
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            Dashboard
          </Button>

          {/* System Status Indicator */}
          <Tooltip title={status?.isOnline ? 'System Online' : 'System Offline'}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: status?.isOnline ? 'success.main' : 'error.main',
                mx: 1,
              }}
            />
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              color="inherit"
              onClick={handleNotificationClick}
            >
              <Badge badgeContent={unreadNotifications} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Settings */}
          <Tooltip title="Settings">
            <IconButton
              color="inherit"
              onClick={() => handleNavigate('/settings')}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          {/* Admin */}
          <Tooltip title="Admin Panel">
            <IconButton
              color="inherit"
              onClick={() => handleNavigate('/admin')}
            >
              <AdminIcon />
            </IconButton>
          </Tooltip>

          {/* Account Menu */}
          <IconButton
            color="inherit"
            onClick={handleAccountClick}
          >
            <AccountIcon />
          </IconButton>
        </Box>

        {/* Notification Menu */}
        <Menu
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {status?.errors?.filter(e => !e.resolved).slice(0, 5).map((error) => (
            <MenuItem key={error.id} onClick={handleClose}>
              <Box>
                <Typography variant="body2">{error.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {error.type} • {error.channel}
                </Typography>
              </Box>
            </MenuItem>
          )) || (
            <MenuItem onClick={handleClose}>
              <Typography variant="body2" color="text.secondary">
                No new notifications
              </Typography>
            </MenuItem>
          )}
        </Menu>

        {/* Account Menu */}
        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={() => handleNavigate('/settings')}>
            <SettingsIcon sx={{ mr: 2 }} />
            Settings
          </MenuItem>
          <MenuItem onClick={() => handleNavigate('/admin')}>
            <AdminIcon sx={{ mr: 2 }} />
            Admin Panel
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};