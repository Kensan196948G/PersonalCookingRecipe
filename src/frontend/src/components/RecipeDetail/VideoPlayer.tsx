import React, { useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  Fullscreen as FullscreenIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import YouTube from 'react-youtube';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  autoPlay?: boolean;
  width?: string | number;
  height?: string | number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  autoPlay = false,
  width = '100%',
  height = '400px',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [player, setPlayer] = useState<any>(null);

  const opts = {
    height: typeof height === 'string' ? parseInt(height) : height,
    width: typeof width === 'string' ? '100%' : width,
    playerVars: {
      autoplay: autoPlay ? 1 : 0,
      controls: 1,
      rel: 0, // Don't show related videos
      modestbranding: 1, // Hide YouTube logo
      playsinline: 1, // Play inline on mobile
      origin: window.location.origin, // For embedded player security
    },
  };

  const handleReady = (event: any) => {
    setPlayer(event.target);
    setHasError(false);
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnd = () => {
    setIsPlaying(false);
  };

  const handleError = (event: any) => {
    console.error('YouTube player error:', event);
    setHasError(true);
  };

  const handlePlayPause = () => {
    if (player) {
      if (isPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }
  };

  const handleOpenInYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer');
  };

  const handleFullscreen = () => {
    if (player) {
      // YouTube player doesn't expose fullscreen API directly
      // Open in new tab as alternative
      handleOpenInYouTube();
    }
  };

  if (hasError) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">
            Failed to load video
          </Typography>
          <Typography variant="body2">
            This video may be unavailable or restricted.
          </Typography>
        </Alert>
        <IconButton
          onClick={handleOpenInYouTube}
          color="primary"
          sx={{ mt: 2 }}
        >
          <OpenInNewIcon />
          <Typography variant="button" sx={{ ml: 1 }}>
            Open in YouTube
          </Typography>
        </IconButton>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      {/* Video Player */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          '& iframe': {
            width: '100%',
            height: '100%',
            border: 'none',
          },
        }}
      >
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={handleReady}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnd={handleEnd}
          onError={handleError}
        />
      </Box>

      {/* Custom Controls Overlay (if needed) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: 0,
          transition: 'opacity 0.3s ease',
          '&:hover': {
            opacity: 1,
          },
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <IconButton
              onClick={handlePlayPause}
              sx={{ color: 'white' }}
              size="small"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          
          <Typography variant="caption" sx={{ color: 'white', ml: 1 }}>
            {title}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Open in YouTube">
            <IconButton
              onClick={handleOpenInYouTube}
              sx={{ color: 'white' }}
              size="small"
            >
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Fullscreen">
            <IconButton
              onClick={handleFullscreen}
              sx={{ color: 'white' }}
              size="small"
            >
              <FullscreenIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Loading State */}
      {!player && !hasError && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
          }}
        >
          <Typography variant="body2">Loading video...</Typography>
        </Box>
      )}
    </Paper>
  );
};