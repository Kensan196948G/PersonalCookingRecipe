import React, { useState } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  VolumeXIcon, 
  Volume2Icon, 
  MaximizeIcon,
  ExternalLinkIcon 
} from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  autoPlay?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  autoPlay = false,
  width = '100%',
  height = '400px',
  className = '',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const embedUrl = `https://www.youtube.com/embed/${videoId}?${new URLSearchParams({
    autoplay: autoPlay ? '1' : '0',
    controls: '1',
    rel: '0', // Don't show related videos
    modestbranding: '1', // Hide YouTube logo
    playsinline: '1', // Play inline on mobile
  })}`;

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const handleIframeLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleIframeError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  const handleOpenInYouTube = () => {
    window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
  };

  if (hasError) {
    return (
      <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              動画を読み込めませんでした
            </p>
            <button
              onClick={handleOpenInYouTube}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              YouTubeで開く
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative bg-black rounded-lg overflow-hidden group ${className}`}
      style={{ height }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* YouTube iframe */}
      <iframe
        src={embedUrl}
        title={title}
        width="100%"
        height="100%"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        className="w-full h-full"
      />

      {/* Loading indicator */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}

      {/* Custom controls overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-white text-sm font-medium truncate max-w-xs">
              {title}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenInYouTube}
              className="text-white hover:text-gray-300 transition-colors"
              title="YouTubeで開く"
            >
              <ExternalLinkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Thumbnail overlay (shown before video loads) */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            <PlayIcon className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">動画を読み込み中...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple YouTube thumbnail component for when video isn't loaded
export const YouTubeThumbnail: React.FC<{
  videoId: string;
  title: string;
  onClick?: () => void;
  className?: string;
}> = ({ videoId, title, onClick, className = '' }) => {
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  
  return (
    <div 
      className={`relative cursor-pointer group ${className}`}
      onClick={onClick}
    >
      <img 
        src={thumbnailUrl} 
        alt={title}
        className="w-full h-full object-cover rounded-lg"
        onError={(e) => {
          // Fallback to standard thumbnail if maxres is not available
          e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }}
      />
      <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="bg-red-600 rounded-full p-3">
          <PlayIcon className="w-8 h-8 text-white" />
        </div>
      </div>
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-white text-sm font-medium bg-black bg-opacity-50 px-2 py-1 rounded truncate">
          {title}
        </p>
      </div>
    </div>
  );
};