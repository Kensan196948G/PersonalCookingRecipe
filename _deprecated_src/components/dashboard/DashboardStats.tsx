import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChefHat, 
  Heart, 
  Eye, 
  Users, 
  TrendingUp, 
  Star,
  BookOpen,
  Clock,
  Trophy,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export interface DashboardData {
  totalRecipes: number;
  totalViews: number;
  totalLikes: number;
  totalFollowers: number;
  recentViews: number;
  recentLikes: number;
  popularRecipe: {
    id: string;
    title: string;
    views: number;
    likes: number;
    imageUrl?: string;
  } | null;
  viewsChart: Array<{
    date: string;
    views: number;
    likes: number;
  }>;
  recipesByCategory: Array<{
    name: string;
    count: number;
    color: string;
  }>;
  topRecipes: Array<{
    id: string;
    title: string;
    views: number;
    likes: number;
    rating: number;
  }>;
  monthlyStats: {
    recipesCreated: number;
    averageRating: number;
    engagementRate: number;
  };
}

interface DashboardStatsProps {
  data: DashboardData;
  isLoading?: boolean;
  className?: string;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  delay?: number;
}> = ({ title, value, subtitle, icon, trend, color = 'orange', delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                {subtitle && (
                  <p className="text-sm text-gray-500">{subtitle}</p>
                )}
                {trend && (
                  <div className={`flex items-center text-sm ${
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendingUp className={`w-4 h-4 mr-1 ${
                      !trend.isPositive ? 'rotate-180' : ''
                    }`} />
                    <span>{Math.abs(trend.value)}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`p-3 rounded-full bg-${color}-100`}>
              <div className={`text-${color}-600`}>
                {icon}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  data,
  isLoading = false,
  className = ''
}) => {
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                    <div className="h-8 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="総レシピ数"
          value={data.totalRecipes}
          subtitle={`今月 +${data.monthlyStats.recipesCreated}件`}
          icon={<ChefHat className="w-6 h-6" />}
          trend={{
            value: data.monthlyStats.recipesCreated > 0 ? 15 : 0,
            isPositive: true
          }}
          color="orange"
          delay={0}
        />
        
        <StatCard
          title="総閲覧数"
          value={formatNumber(data.totalViews)}
          subtitle={`最近7日間 +${formatNumber(data.recentViews)}`}
          icon={<Eye className="w-6 h-6" />}
          trend={{
            value: 12,
            isPositive: true
          }}
          color="blue"
          delay={0.1}
        />
        
        <StatCard
          title="総いいね数"
          value={formatNumber(data.totalLikes)}
          subtitle={`最近7日間 +${formatNumber(data.recentLikes)}`}
          icon={<Heart className="w-6 h-6" />}
          trend={{
            value: 8,
            isPositive: true
          }}
          color="red"
          delay={0.2}
        />
        
        <StatCard
          title="フォロワー数"
          value={formatNumber(data.totalFollowers)}
          subtitle="エンゲージメント率"
          icon={<Users className="w-6 h-6" />}
          trend={{
            value: data.monthlyStats.engagementRate,
            isPositive: data.monthlyStats.engagementRate > 0
          }}
          color="green"
          delay={0.3}
        />
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Views & Likes Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                閲覧数・いいね数の推移
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.viewsChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value, name) => [formatNumber(value as number), name === 'views' ? '閲覧数' : 'いいね数']}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('ja-JP')}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stackId="1"
                      stroke="#f97316"
                      fill="#fed7aa"
                      name="views"
                    />
                    <Area
                      type="monotone"
                      dataKey="likes"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#fecaca"
                      name="likes"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recipe Categories */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                カテゴリー別レシピ数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.recipesByCategory}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.recipesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}件`, 'レシピ数']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Popular Recipe & Top Recipes */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Most Popular Recipe */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                今月の人気レシピ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.popularRecipe ? (
                <div className="space-y-4">
                  {data.popularRecipe.imageUrl && (
                    <img
                      src={data.popularRecipe.imageUrl}
                      alt={data.popularRecipe.title}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-2">
                      {data.popularRecipe.title}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{formatNumber(data.popularRecipe.views)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        <span>{formatNumber(data.popularRecipe.likes)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  まだレシピがありません
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Recipes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-600" />
                人気レシピトップ5
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.topRecipes.length > 0 ? (
                <div className="space-y-4">
                  {data.topRecipes.map((recipe, index) => (
                    <div 
                      key={recipe.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant="secondary" 
                          className={`${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {index + 1}
                        </Badge>
                        <div>
                          <h4 className="font-medium line-clamp-1">{recipe.title}</h4>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              <span>{formatNumber(recipe.views)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              <span>{formatNumber(recipe.likes)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              <span>{recipe.rating.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  まだレシピがありません
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Additional Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">平均評価</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.monthlyStats.averageRating.toFixed(1)}
                  </p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
              <Progress value={data.monthlyStats.averageRating * 20} className="h-2" />
              <p className="text-sm text-gray-500 mt-2">5.0点満点</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">エンゲージメント率</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.monthlyStats.engagementRate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
              <Progress value={data.monthlyStats.engagementRate} className="h-2" />
              <p className="text-sm text-gray-500 mt-2">いいね率・コメント率</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">今月の投稿数</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.monthlyStats.recipesCreated}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-sm text-gray-500">
                平均 {(data.monthlyStats.recipesCreated / 4).toFixed(1)}件/週
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};