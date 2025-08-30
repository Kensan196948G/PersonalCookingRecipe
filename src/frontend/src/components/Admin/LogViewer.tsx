import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Toolbar,
  Tooltip,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useSystemLogs } from '@/hooks/useSystem';
import { format } from 'date-fns';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  source: string;
  details?: any;
}

export const LogViewer: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const { logs, isLoading, error, refetch } = useSystemLogs();

  // Mock log data - replace with actual API data
  const mockLogs: LogEntry[] = [
    {
      id: '1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Successfully fetched recipes from YouTube channel',
      source: 'youtube-monitor',
      details: { channel: 'Tasty', recipesFound: 12 }
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      level: 'warning',
      message: 'Rate limit approaching for Tasty API',
      source: 'tasty-api',
      details: { remainingCalls: 45, resetTime: '2024-01-01T15:00:00Z' }
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      level: 'error',
      message: 'Failed to connect to Notion database',
      source: 'notion-sync',
      details: { error: 'Unauthorized', retryCount: 3 }
    },
  ];

  const displayLogs = logs || mockLogs;

  const filteredLogs = displayLogs.filter((log) => {
    const matchesSearch = !filter || 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.source.toLowerCase().includes(filter.toLowerCase());
    
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSource = sourceFilter === 'all' || log.source === sourceFilter;
    
    return matchesSearch && matchesLevel && matchesSource;
  });

  const paginatedLogs = filteredLogs.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const uniqueSources = Array.from(new Set(displayLogs.map(log => log.source)));

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      case 'debug': return 'default';
      default: return 'default';
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleExportLogs = () => {
    const csv = [
      'Timestamp,Level,Source,Message,Details',
      ...filteredLogs.map(log => [
        log.timestamp,
        log.level,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`,
        log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilter('');
    setLevelFilter('all');
    setSourceFilter('all');
    setPage(0);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        System Logs
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load system logs: {error.message}
        </Alert>
      )}

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Paper>
        {/* Toolbar */}
        <Toolbar sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box display="flex" alignItems="center" gap={2} sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              size="small"
              placeholder="Search logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              }}
              sx={{ minWidth: 200 }}
            />
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Level</InputLabel>
              <Select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                label="Level"
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Source</InputLabel>
              <Select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                label="Source"
              >
                <MenuItem value="all">All Sources</MenuItem>
                {uniqueSources.map((source) => (
                  <MenuItem key={source} value={source}>
                    {source}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {(filter || levelFilter !== 'all' || sourceFilter !== 'all') && (
              <Tooltip title="Clear filters">
                <IconButton onClick={clearFilters} size="small">
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">
              {filteredLogs.length} entries
            </Typography>
            
            <Tooltip title="Refresh logs">
              <IconButton onClick={() => refetch()} disabled={isLoading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Export logs">
              <IconButton onClick={handleExportLogs}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>

        {/* Logs Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLogs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={log.level.toUpperCase()}
                      size="small"
                      color={getLevelColor(log.level) as any}
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={log.source}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {log.message}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    {log.details && (
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={JSON.stringify(log.details, null, 2)}
                      >
                        {JSON.stringify(log.details)}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              
              {paginatedLogs.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No logs found matching the current filters
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={filteredLogs.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    </Box>
  );
};