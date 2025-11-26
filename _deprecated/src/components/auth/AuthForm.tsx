import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  ChefHat,
  Github,
  Chrome,
  Apple
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2, '名前は2文字以上で入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '大文字、小文字、数字を含める必要があります'),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine((val) => val, '利用規約に同意してください'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export interface AuthFormProps {
  mode?: 'login' | 'register';
  onSubmit: (data: LoginFormData | RegisterFormData, mode: 'login' | 'register') => Promise<void>;
  onModeChange?: (mode: 'login' | 'register') => void;
  onSocialLogin?: (provider: 'google' | 'github' | 'apple') => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  mode = 'login',
  onSubmit,
  onModeChange,
  onSocialLogin,
  onForgotPassword,
  isLoading = false,
  error,
  className = ''
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const isLogin = mode === 'login';
  const schema = isLogin ? loginSchema : registerSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LoginFormData | RegisterFormData>({
    resolver: zodResolver(schema),
  });

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    reset();
    setShowForgotPassword(false);
    onModeChange?.(newMode);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotPasswordEmail && onForgotPassword) {
      await onForgotPassword(forgotPasswordEmail);
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    }
  };

  const socialButtons = [
    { provider: 'google' as const, icon: Chrome, label: 'Google', color: 'bg-red-500 hover:bg-red-600' },
    { provider: 'github' as const, icon: Github, label: 'GitHub', color: 'bg-gray-800 hover:bg-gray-900' },
    { provider: 'apple' as const, icon: Apple, label: 'Apple', color: 'bg-black hover:bg-gray-800' },
  ];

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="mx-auto mb-4 p-3 bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center"
            >
              <ChefHat className="w-8 h-8 text-orange-600" />
            </motion.div>
            
            <CardTitle className="text-2xl font-bold">
              {showForgotPassword ? 'パスワードをリセット' : isLogin ? 'ログイン' : 'アカウント作成'}
            </CardTitle>
            
            <CardDescription>
              {showForgotPassword 
                ? 'メールアドレスを入力してください'
                : isLogin 
                  ? 'アカウントにログインしてください'
                  : '新しいアカウントを作成しましょう'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {showForgotPassword ? (
                <motion.form
                  key="forgot-password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleForgotPasswordSubmit}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="forgot-email">メールアドレス</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="example@example.com"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !forgotPasswordEmail}
                  >
                    {isLoading ? '送信中...' : 'リセットリンクを送信'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    ログインに戻る
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key={isLogin ? 'login' : 'register'}
                  initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                  onSubmit={handleSubmit((data) => onSubmit(data, mode))}
                  className="space-y-4"
                >
                  {/* Name field (Register only) */}
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Label htmlFor="name">名前</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="name"
                          type="text"
                          placeholder="山田太郎"
                          className={`pl-10 ${errors.name ? 'border-red-500' : ''}`}
                          {...register('name')}
                        />
                      </div>
                      {errors.name && (
                        <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                      )}
                    </motion.div>
                  )}

                  {/* Email field */}
                  <div>
                    <Label htmlFor="email">メールアドレス</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="example@example.com"
                        className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                        {...register('email')}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password field */}
                  <div>
                    <Label htmlFor="password">パスワード</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isLogin ? 'パスワード' : '8文字以上、大文字・小文字・数字を含む'}
                        className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                    )}
                  </div>

                  {/* Confirm Password field (Register only) */}
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Label htmlFor="confirmPassword">パスワード確認</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="パスワードを再入力"
                          className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                          {...register('confirmPassword')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
                      )}
                    </motion.div>
                  )}

                  {/* Remember Me / Terms checkbox */}
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id={isLogin ? 'rememberMe' : 'agreeToTerms'}
                      {...register(isLogin ? 'rememberMe' : 'agreeToTerms')}
                    />
                    <Label 
                      htmlFor={isLogin ? 'rememberMe' : 'agreeToTerms'}
                      className="text-sm leading-5"
                    >
                      {isLogin ? (
                        'ログイン状態を保持する'
                      ) : (
                        <>
                          <a href="/terms" className="text-orange-600 hover:underline">利用規約</a>
                          と
                          <a href="/privacy" className="text-orange-600 hover:underline">プライバシーポリシー</a>
                          に同意します
                        </>
                      )}
                    </Label>
                  </div>
                  {!isLogin && errors.agreeToTerms && (
                    <p className="text-red-500 text-sm">{errors.agreeToTerms.message}</p>
                  )}

                  {/* Error message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-md"
                    >
                      <p className="text-red-600 text-sm">{error}</p>
                    </motion.div>
                  )}

                  {/* Submit button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading 
                      ? (isLogin ? 'ログイン中...' : 'アカウント作成中...') 
                      : (isLogin ? 'ログイン' : 'アカウントを作成')
                    }
                  </Button>

                  {/* Forgot password link (Login only) */}
                  {isLogin && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-orange-600 hover:underline"
                      >
                        パスワードをお忘れですか？
                      </button>
                    </div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>

            {/* Social login (not shown in forgot password mode) */}
            {!showForgotPassword && onSocialLogin && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">または</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {socialButtons.map(({ provider, icon: Icon, label, color }) => (
                    <Button
                      key={provider}
                      variant="outline"
                      className={`w-full text-white ${color} border-0`}
                      onClick={() => onSocialLogin(provider)}
                      disabled={isLoading}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {label}で{isLogin ? 'ログイン' : 'アカウント作成'}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {/* Mode switch */}
            {!showForgotPassword && (
              <div className="text-center text-sm">
                <span className="text-gray-600">
                  {isLogin ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
                </span>
                <button
                  type="button"
                  onClick={() => handleModeSwitch(isLogin ? 'register' : 'login')}
                  className="ml-1 text-orange-600 hover:underline font-medium"
                  disabled={isLoading}
                >
                  {isLogin ? 'アカウント作成' : 'ログイン'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};