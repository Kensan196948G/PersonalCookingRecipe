import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Wifi, 
  WifiOff, 
  Server,
  Activity,
  Zap,
  Shield
} from 'lucide-react';

interface StatusIndicatorProps {
  type: 'success' | 'error' | 'warning' | 'info' | 'loading' | 'online' | 'offline' | 'processing';
  message: string;
  detail?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  animated?: boolean;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  type,
  message,
  detail,
  size = 'md',
  showIcon = true,
  animated = true,
  className = ''
}) => {
  const getStatusConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          bgColor: 'bg-success-50 dark:bg-success-900/20',
          borderColor: 'border-success-200 dark:border-success-700',
          textColor: 'text-success-700 dark:text-success-300',
          iconColor: 'text-success-500',
          pulseColor: 'animate-pulse'
        };
      case 'error':
        return {
          icon: XCircle,
          bgColor: 'bg-error-50 dark:bg-error-900/20',
          borderColor: 'border-error-200 dark:border-error-700',
          textColor: 'text-error-700 dark:text-error-300',
          iconColor: 'text-error-500',
          pulseColor: 'animate-pulse'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          bgColor: 'bg-warning-50 dark:bg-warning-900/20',
          borderColor: 'border-warning-200 dark:border-warning-700',
          textColor: 'text-warning-700 dark:text-warning-300',
          iconColor: 'text-warning-500',
          pulseColor: 'animate-pulse'
        };
      case 'info':
        return {
          icon: Activity,
          bgColor: 'bg-kitchen-50 dark:bg-kitchen-900/20',
          borderColor: 'border-kitchen-200 dark:border-kitchen-700',
          textColor: 'text-kitchen-700 dark:text-kitchen-300',
          iconColor: 'text-kitchen-500',
          pulseColor: 'animate-pulse'
        };
      case 'loading':
        return {
          icon: Clock,
          bgColor: 'bg-gray-50 dark:bg-gray-800/50',
          borderColor: 'border-gray-200 dark:border-gray-600',
          textColor: 'text-gray-700 dark:text-gray-300',
          iconColor: 'text-gray-500',
          pulseColor: 'animate-spin'
        };
      case 'online':
        return {
          icon: Wifi,
          bgColor: 'bg-cooking-50 dark:bg-cooking-900/20',
          borderColor: 'border-cooking-200 dark:border-cooking-700',
          textColor: 'text-cooking-700 dark:text-cooking-300',
          iconColor: 'text-cooking-500',
          pulseColor: 'animate-pulse'
        };
      case 'offline':
        return {
          icon: WifiOff,
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          borderColor: 'border-gray-300 dark:border-gray-600',
          textColor: 'text-gray-600 dark:text-gray-400',
          iconColor: 'text-gray-400',
          pulseColor: ''
        };
      case 'processing':
        return {
          icon: Zap,
          bgColor: 'bg-recipe-50 dark:bg-recipe-900/20',
          borderColor: 'border-recipe-200 dark:border-recipe-700',
          textColor: 'text-recipe-700 dark:text-recipe-300',
          iconColor: 'text-recipe-500',
          pulseColor: 'animate-bounce'
        };
      default:
        return {
          icon: Activity,
          bgColor: 'bg-gray-50 dark:bg-gray-800/50',
          borderColor: 'border-gray-200 dark:border-gray-600',
          textColor: 'text-gray-700 dark:text-gray-300',
          iconColor: 'text-gray-500',
          pulseColor: ''
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-3 py-2 text-sm',
          icon: 'w-4 h-4',
          spacing: 'space-x-2'
        };
      case 'lg':
        return {
          container: 'px-6 py-4 text-lg',
          icon: 'w-6 h-6',
          spacing: 'space-x-3'
        };
      default:
        return {
          container: 'px-4 py-3 text-base',
          icon: 'w-5 h-5',
          spacing: 'space-x-2'
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = getSizeClasses();
  const IconComponent = config.icon;

  return (
    <div
      className={`
        inline-flex items-center
        ${sizeClasses.container}
        ${sizeClasses.spacing}
        ${config.bgColor}
        ${config.borderColor}
        ${config.textColor}
        border rounded-lg
        transition-all duration-200
        ${animated ? 'animate-fade-in' : ''}
        ${className}
      `}
      role="status"
      aria-live="polite"
    >
      {showIcon && (
        <IconComponent
          className={`
            ${sizeClasses.icon}
            ${config.iconColor}
            ${animated && config.pulseColor}
            flex-shrink-0
          `}
          aria-hidden="true"
        />
      )}
      
      <div className="flex-1">
        <div className="font-medium">
          {message}
        </div>
        
        {detail && (
          <div className="text-sm opacity-75 mt-1">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusIndicator;