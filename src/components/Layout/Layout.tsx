import React, { ReactNode } from 'react'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  PlayArrow as WorkflowIcon,
  SmartToy as AgentIcon,
  Analytics as AnalyticsIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountIcon,
  Brightness4,
  Brightness7,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../../store'
import { toggleSidebar, toggleTheme } from '../../store/slices/uiSlice'
import { selectIsConnected } from '../../store/slices/websocketSlice'

// Utility component for consistent metric value display
export const MetricValue: React.FC<{
  value: number | null | undefined
  formatter?: (value: number) => string
  nullText?: string
  className?: string
}> = ({ 
  value, 
  formatter = (val) => val.toString(), 
  nullText = 'nil',
  className 
}) => {
  if (value === null || value === undefined) {
    return (
      <span 
        className={className}
        style={{ 
          fontStyle: 'italic', 
          color: 'rgba(0, 0, 0, 0.6)',
          opacity: 0.7
        }}
      >
        {nullText}
      </span>
    )
  }
  
  return <span className={className}>{formatter(value)}</span>
}

// Utility formatters for common metric types
export const formatters = {
  percentage: (value: number) => `${value.toFixed(1)}%`,
  currency: (value: number) => `$${value.toLocaleString()}`,
  decimal: (decimals: number = 1) => (value: number) => value.toFixed(decimals),
  integer: (value: number) => Math.round(value).toString(),
  duration: (value: number) => `${value.toFixed(1)}s`,
  count: (value: number) => value.toLocaleString(),
}

const DRAWER_WIDTH = 280

interface LayoutProps {
  children: ReactNode
}

const navigationItems = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
  { label: 'Workflows', path: '/workflows', icon: WorkflowIcon },
  { label: 'Agents', path: '/agents', icon: AgentIcon },
  { label: 'Analytics', path: '/analytics', icon: AnalyticsIcon },
  { label: 'Reports', path: '/reports', icon: ReportsIcon },
  { label: 'Settings', path: '/settings', icon: SettingsIcon },
]

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  
  const { sidebarOpen, sidebarWidth, theme: appTheme, notifications } = useAppSelector((state) => state.ui)
  const isWebSocketConnected = useAppSelector(selectIsConnected)
  
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [notificationAnchorEl, setNotificationAnchorEl] = React.useState<null | HTMLElement>(null)

  const unreadNotifications = notifications.filter(n => !n.read).length

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setNotificationAnchorEl(null)
  }

  const handleNavigation = (path: string) => {
    navigate(path)
  }

  const renderSidebar = () => (
    <Drawer
      variant="persistent"
      anchor="left"
      open={sidebarOpen}
      sx={{
        width: sidebarOpen ? sidebarWidth : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: sidebarWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid ' + theme.palette.divider,
        },
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          LangGraph Analytics
        </Typography>
      </Toolbar>
      <Divider />
      
      {/* Connection Status */}
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            borderRadius: 1,
            backgroundColor: isWebSocketConnected ? 'success.light' : 'error.light',
            color: isWebSocketConnected ? 'success.contrastText' : 'error.contrastText',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isWebSocketConnected ? 'success.main' : 'error.main',
            }}
          />
          <Typography variant="caption">
            {isWebSocketConnected ? 'Connected' : 'Disconnected'}
          </Typography>
        </Box>
      </Box>

      <List>
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isActive}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 1,
                  mx: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.light,
                    color: theme.palette.primary.contrastText,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.main,
                    },
                  },
                }}
              >
                <ListItemIcon>
                  <Icon color={isActive ? 'inherit' : 'primary'} />
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Drawer>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            onClick={() => dispatch(toggleSidebar())}
            edge="start"
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, ml: 2 }}>
            Advanced Analytics Dashboard
          </Typography>

          {/* Theme Toggle */}
          <IconButton onClick={() => dispatch(toggleTheme())} color="inherit">
            {appTheme === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>

          {/* Notifications */}
          <IconButton
            color="inherit"
            onClick={handleNotificationMenuOpen}
          >
            <Badge badgeContent={unreadNotifications} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          {/* Profile Menu */}
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              <AccountIcon />
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {renderSidebar()}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8, // Account for AppBar height
          ml: sidebarOpen ? 0 : '-' + sidebarWidth + 'px',
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: theme.palette.background.default,
        }}
      >
        {children}
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
        <MenuItem onClick={handleMenuClose}>My Account</MenuItem>
        <MenuItem onClick={handleMenuClose}>Logout</MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationAnchorEl}
        open={Boolean(notificationAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { width: 320, maxHeight: 400 }
        }}
      >
        {notifications.length === 0 ? (
          <MenuItem>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </MenuItem>
        ) : (
          notifications.slice(0, 5).map((notification) => (
            <MenuItem key={notification.id} onClick={handleMenuClose}>
              <Box>
                <Typography variant="subtitle2">{notification.title}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {notification.message}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  )
}

export default Layout
