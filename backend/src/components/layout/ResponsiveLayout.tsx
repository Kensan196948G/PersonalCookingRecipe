import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Menu, 
  Home, 
  ChefHat, 
  Search, 
  Plus, 
  User, 
  Settings,
  Heart,
  BookOpen,
  TrendingUp,
  LogOut,
  Bell,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  user?: User | null;
  onLogout?: () => void;
  className?: string;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  {
    icon: <Home className="w-5 h-5" />,
    label: 'ホーム',
    href: '/',
  },
  {
    icon: <Search className="w-5 h-5" />,
    label: '検索',
    href: '/search',
  },
  {
    icon: <Plus className="w-5 h-5" />,
    label: 'レシピ作成',
    href: '/recipes/new',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    label: 'ダッシュボード',
    href: '/dashboard',
  },
];

const USER_NAV_ITEMS: NavItem[] = [
  {
    icon: <BookOpen className="w-5 h-5" />,
    label: 'マイレシピ',
    href: '/my-recipes',
  },
  {
    icon: <Heart className="w-5 h-5" />,
    label: 'お気に入り',
    href: '/favorites',
  },
  {
    icon: <Settings className="w-5 h-5" />,
    label: '設定',
    href: '/settings',
  },
];

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  user,
  onLogout,
  className = ''
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<number>(3); // Mock notification count
  const router = useRouter();

  // Close mobile menu when route changes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMobileMenuOpen(false);
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router]);

  const isActive = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(href);
  };

  const NavLink: React.FC<{ item: NavItem; onClick?: () => void }> = ({ item, onClick }) => (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-gray-100 ${
        isActive(item.href) 
          ? 'bg-orange-50 text-orange-600 border-r-2 border-orange-600' 
          : 'text-gray-700'
      }`}
    >
      {item.icon}
      <span className="font-medium">{item.label}</span>
      {item.badge && (
        <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
          {item.badge}
        </span>
      )}
    </Link>
  );

  const UserProfile: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
    <div className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg ${compact ? 'justify-center' : ''}`}>
      {user?.avatar ? (
        <Image
          src={user.avatar}
          alt={user.name}
          width={40}
          height={40}
          className="rounded-full"
        />
      ) : (
        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600" />
        </div>
      )}
      {!compact && (
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{user?.name || 'ゲスト'}</p>
          <p className="text-sm text-gray-500 truncate">{user?.email || 'ログインしてください'}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-white lg:shadow-sm">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 py-4 border-b">
            <ChefHat className="w-8 h-8 text-orange-600" />
            <span className="text-xl font-bold text-gray-900">CookingRecipe</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-8">
            {/* Main Navigation */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                メイン
              </h3>
              <div className="space-y-1">
                {MAIN_NAV_ITEMS.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>

            {/* User Navigation */}
            {user && (
              <div>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  マイページ
                </h3>
                <div className="space-y-1">
                  {USER_NAV_ITEMS.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t">
            {user ? (
              <div className="space-y-3">
                <UserProfile />
                <Button
                  variant="ghost"
                  onClick={onLogout}
                  className="w-full justify-start text-gray-700 hover:text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  ログアウト
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/auth/login">ログイン</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/register">アカウント作成</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex flex-col h-full">
                  {/* Mobile Logo */}
                  <div className="flex items-center justify-between px-4 py-4 border-b">
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-6 h-6 text-orange-600" />
                      <span className="font-bold text-gray-900">CookingRecipe</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Mobile Navigation */}
                  <nav className="flex-1 px-4 py-6 space-y-6">
                    {/* Main Navigation */}
                    <div className="space-y-1">
                      {MAIN_NAV_ITEMS.map((item) => (
                        <NavLink 
                          key={item.href} 
                          item={item} 
                          onClick={() => setIsMobileMenuOpen(false)}
                        />
                      ))}
                    </div>

                    {/* User Navigation */}
                    {user && (
                      <>
                        <div className="border-t pt-6">
                          <div className="space-y-1">
                            {USER_NAV_ITEMS.map((item) => (
                              <NavLink 
                                key={item.href} 
                                item={item} 
                                onClick={() => setIsMobileMenuOpen(false)}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </nav>

                  {/* Mobile User Profile */}
                  <div className="p-4 border-t">
                    {user ? (
                      <div className="space-y-3">
                        <UserProfile />
                        <Button
                          variant="ghost"
                          onClick={() => {
                            onLogout?.();
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full justify-start text-gray-700 hover:text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          ログアウト
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Button 
                          asChild 
                          className="w-full"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Link href="/auth/login">ログイン</Link>
                        </Button>
                        <Button 
                          asChild 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Link href="/auth/register">アカウント作成</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-orange-600" />
              <span className="font-bold text-gray-900">CookingRecipe</span>
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="w-5 h-5" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                  {notifications > 9 ? '9+' : notifications}
                </span>
              )}
            </Button>

            {/* User Avatar */}
            {user && (
              <Button variant="ghost" size="sm" className="p-1">
                <UserProfile compact />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64">
        <div className="px-4 py-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t">
        <div className="grid grid-cols-4 gap-1 p-2">
          {MAIN_NAV_ITEMS.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${
                isActive(item.href)
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              <span className="text-xs font-medium truncate w-full text-center">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom padding for mobile navigation */}
      <div className="lg:hidden h-20" />
    </div>
  );
};