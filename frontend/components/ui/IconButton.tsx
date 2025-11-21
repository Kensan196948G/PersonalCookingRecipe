import React, { ButtonHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  tooltip?: string;
  badge?: string | number;
  glow?: boolean;
  children?: React.ReactNode;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  variant = 'primary',
  size = 'md',
  loading = false,
  tooltip,
  badge,
  glow = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return `
          bg-kitchen-500 hover:bg-kitchen-600 
          text-white border-kitchen-500 hover:border-kitchen-600
          shadow-kitchen focus:ring-kitchen-300 dark:focus:ring-kitchen-600
          ${glow ? 'shadow-glow' : ''}
        `;
      case 'secondary':
        return `
          bg-gray-100 hover:bg-gray-200 
          text-gray-700 border-gray-200 hover:border-gray-300
          dark:bg-gray-700 dark:hover:bg-gray-600 
          dark:text-gray-200 dark:border-gray-600
          focus:ring-gray-300 dark:focus:ring-gray-500
        `;
      case 'success':
        return `
          bg-cooking-500 hover:bg-cooking-600 
          text-white border-cooking-500 hover:border-cooking-600
          shadow-cooking focus:ring-cooking-300 dark:focus:ring-cooking-600
        `;
      case 'warning':
        return `
          bg-warning-500 hover:bg-warning-600 
          text-white border-warning-500 hover:border-warning-600
          focus:ring-warning-300 dark:focus:ring-warning-600
        `;
      case 'error':
        return `
          bg-error-500 hover:bg-error-600 
          text-white border-error-500 hover:border-error-600
          focus:ring-error-300 dark:focus:ring-error-600
        `;
      case 'ghost':
        return `
          bg-transparent hover:bg-gray-100 
          text-gray-700 hover:text-gray-900
          border-transparent hover:border-gray-200
          dark:hover:bg-gray-800 dark:text-gray-300 dark:hover:text-gray-100
          focus:ring-gray-300 dark:focus:ring-gray-600
        `;
      case 'outline':
        return `
          bg-transparent hover:bg-kitchen-50 
          text-kitchen-600 hover:text-kitchen-700
          border-kitchen-300 hover:border-kitchen-400
          dark:hover:bg-kitchen-900/20 dark:text-kitchen-400 dark:hover:text-kitchen-300
          dark:border-kitchen-700 dark:hover:border-kitchen-600
          focus:ring-kitchen-300 dark:focus:ring-kitchen-600
        `;
      default:
        return '';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return {
          button: 'p-1',
          icon: 'w-3 h-3',
          text: 'text-xs'
        };
      case 'sm':
        return {
          button: 'p-1.5',
          icon: 'w-4 h-4',
          text: 'text-sm'
        };
      case 'lg':
        return {
          button: 'p-3',
          icon: 'w-6 h-6',
          text: 'text-lg'
        };
      case 'xl':
        return {
          button: 'p-4',
          icon: 'w-8 h-8',
          text: 'text-xl'
        };
      default:
        return {
          button: 'p-2',
          icon: 'w-5 h-5',
          text: 'text-base'
        };
    }
  };

  const variantClasses = getVariantClasses();
  const sizeClasses = getSizeClasses();
  const isDisabled = disabled || loading;

  return (
    <div className="relative inline-block">
      <button
        className={`
          relative inline-flex items-center justify-center
          ${sizeClasses.button}
          ${children ? 'space-x-2' : ''}
          border rounded-lg
          font-medium
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          transform hover:scale-105 active:scale-95
          ${variantClasses}
          ${className}
        `}
        disabled={isDisabled}
        title={tooltip}
        {...props}
      >
        {loading ? (
          <div
            className={`
              ${sizeClasses.icon}
              animate-spin border-2 border-current border-t-transparent 
              rounded-full
            `}
          />
        ) : (
          <Icon
            className={`
              ${sizeClasses.icon}
              ${children ? 'flex-shrink-0' : ''}
            `}
          />
        )}
        
        {children && (
          <span className={sizeClasses.text}>
            {children}
          </span>
        )}

        {/* バッジ */}
        {badge && (
          <span
            className={`
              absolute -top-1 -right-1
              inline-flex items-center justify-center
              min-w-[1.25rem] h-5 px-1
              text-xs font-bold
              text-white bg-error-500 
              rounded-full
              transform scale-75
              animate-bounce-subtle
            `}
          >
            {badge}
          </span>
        )}
      </button>

      {/* ツールチップ */}
      {tooltip && (
        <div
          className="
            absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
            px-2 py-1 text-xs text-white bg-gray-900 rounded
            opacity-0 hover:opacity-100 transition-opacity duration-200
            pointer-events-none whitespace-nowrap
            dark:bg-gray-700
          "
          role="tooltip"
        >
          {tooltip}
          <div
            className="
              absolute top-full left-1/2 transform -translate-x-1/2
              border-4 border-transparent border-t-gray-900
              dark:border-t-gray-700
            "
          />
        </div>
      )}
    </div>
  );
};

export default IconButton;