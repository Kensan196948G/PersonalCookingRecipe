'use client'

/**
 * Context7 Dashboard Component
 * Next.js 14 + TypeScript + Tailwind CSS
 * 
 * Recipe-CTO設計・実装
 * PersonalCookingRecipe統合Context7管理ダッシュボード
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Database, 
  Brain, 
  Monitor, 
  Shield, 
  Zap, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Settings,
  TrendingUp,
  Users,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface Context7Layer {
  id: number;
  name: string;
  status: 'healthy' | 'warning' | 'error';
  utilization: number;
  lastUpdated: string;
  dataSize: string;
  priority: number;
}

interface AgentStatus {
  name: string;
  status: 'active' | 'idle' | 'error';
  layerAccess: number[];
  lastActivity: string;
  tasksCompleted: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  target?: number;
  trend: 'up' | 'down' | 'stable';
}

interface MultimodalContent {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video';
  status: 'processing' | 'completed' | 'failed';
  filename: string;
  size: string;
  processingTime?: number;
}

const Context7Dashboard: React.FC = () => {
  const [layers, setLayers] = useState<Context7Layer[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [multimodalContent, setMultimodalContent] = useState<MultimodalContent[]>([]);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'degraded' | 'error'>('healthy');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Mock data initialization
  useEffect(() => {
    initializeDashboardData();
    
    if (isMonitoring) {
      const interval = setInterval(() => {
        updateDashboardData();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isMonitoring, refreshKey]);

  const initializeDashboardData = () => {
    // Initialize Context7 layers
    setLayers([
      {
        id: 1,
        name: 'プロジェクト基本情報',
        status: 'healthy',
        utilization: 45,
        lastUpdated: new Date().toISOString(),
        dataSize: '12.3MB',
        priority: 10
      },
      {
        id: 2,
        name: 'コード構造・アーキテクチャ',
        status: 'healthy',
        utilization: 67,
        lastUpdated: new Date().toISOString(),
        dataSize: '34.7MB',
        priority: 9
      },
      {
        id: 3,
        name: 'データベース・API設計',
        status: 'warning',
        utilization: 82,
        lastUpdated: new Date().toISOString(),
        dataSize: '78.9MB',
        priority: 8
      },
      {
        id: 4,
        name: '開発進捗・課題管理',
        status: 'healthy',
        utilization: 53,
        lastUpdated: new Date().toISOString(),
        dataSize: '23.1MB',
        priority: 7
      },
      {
        id: 5,
        name: 'パフォーマンス・メトリクス',
        status: 'healthy',
        utilization: 71,
        lastUpdated: new Date().toISOString(),
        dataSize: '45.6MB',
        priority: 6
      },
      {
        id: 6,
        name: 'テスト・品質管理',
        status: 'healthy',
        utilization: 38,
        lastUpdated: new Date().toISOString(),
        dataSize: '19.2MB',
        priority: 5
      },
      {
        id: 7,
        name: 'デプロイ・運用管理',
        status: 'healthy',
        utilization: 29,
        lastUpdated: new Date().toISOString(),
        dataSize: '67.4MB',
        priority: 4
      }
    ]);

    // Initialize agents
    setAgents([
      {
        name: 'Recipe-CTO',
        status: 'active',
        layerAccess: [1, 2, 3, 4, 5, 6, 7],
        lastActivity: new Date().toISOString(),
        tasksCompleted: 147
      },
      {
        name: 'Recipe-Dev',
        status: 'active',
        layerAccess: [1, 2, 3],
        lastActivity: new Date().toISOString(),
        tasksCompleted: 92
      },
      {
        name: 'Recipe-Security',
        status: 'idle',
        layerAccess: [1, 3, 7],
        lastActivity: new Date(Date.now() - 300000).toISOString(),
        tasksCompleted: 34
      },
      {
        name: 'Recipe-Performance',
        status: 'active',
        layerAccess: [1, 5, 6],
        lastActivity: new Date().toISOString(),
        tasksCompleted: 67
      },
      {
        name: 'Recipe-UI',
        status: 'active',
        layerAccess: [1, 2, 4],
        lastActivity: new Date().toISOString(),
        tasksCompleted: 51
      }
    ]);

    // Initialize performance metrics
    setMetrics([
      {
        name: 'JWT認証時間',
        value: 1.32,
        unit: 'ms',
        target: 1.44,
        trend: 'down'
      },
      {
        name: 'Context取得時間',
        value: 87,
        unit: 'ms',
        target: 100,
        trend: 'stable'
      },
      {
        name: 'レシピ分析時間',
        value: 4.2,
        unit: 's',
        target: 5.0,
        trend: 'up'
      },
      {
        name: 'メモリ使用率',
        value: 64,
        unit: '%',
        target: 80,
        trend: 'stable'
      }
    ]);

    // Initialize multimodal content
    setMultimodalContent([
      {
        id: '1',
        type: 'image',
        status: 'completed',
        filename: 'recipe-screenshot-001.png',
        size: '2.3MB',
        processingTime: 450
      },
      {
        id: '2',
        type: 'video',
        status: 'processing',
        filename: 'cooking-demo-sam.mp4',
        size: '87.5MB'
      },
      {
        id: '3',
        type: 'text',
        status: 'completed',
        filename: 'recipe-analysis.json',
        size: '156KB',
        processingTime: 23
      }
    ]);
  };

  const updateDashboardData = () => {
    // Simulate real-time updates
    setLayers(prevLayers => 
      prevLayers.map(layer => ({
        ...layer,
        utilization: Math.max(10, Math.min(95, layer.utilization + (Math.random() - 0.5) * 10)),
        lastUpdated: new Date().toISOString()
      }))
    );

    setMetrics(prevMetrics =>
      prevMetrics.map(metric => ({
        ...metric,
        value: metric.name === 'JWT認証時間' 
          ? Math.max(0.8, Math.min(2.0, metric.value + (Math.random() - 0.5) * 0.1))
          : metric.value + (Math.random() - 0.5) * (metric.value * 0.05)
      }))
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
      case 'idle':
      case 'processing':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'active':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'warning':
      case 'idle':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
  };

  const refreshDashboard = () => {
    setRefreshKey(prev => prev + 1);
  };

  const overallUtilization = layers.reduce((acc, layer) => acc + layer.utilization, 0) / layers.length;
  const activeAgents = agents.filter(agent => agent.status === 'active').length;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Context7 管理ダッシュボード</h1>
          <p className="text-gray-600 mt-1">PersonalCookingRecipe 統合開発環境</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={refreshDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            更新
          </Button>
          <Button 
            variant={isMonitoring ? "default" : "outline"} 
            onClick={toggleMonitoring}
          >
            {isMonitoring ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                監視停止
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                監視開始
              </>
            )}
          </Button>
        </div>
      </div>

      {/* System Status Alert */}
      {systemStatus !== 'healthy' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>システム状態警告</AlertTitle>
          <AlertDescription>
            一部のコンポーネントで問題が検出されました。詳細を確認してください。
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">システム全体使用率</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallUtilization.toFixed(1)}%</div>
            <Progress value={overallUtilization} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">アクティブエージェント</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgents}/{agents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {agents.length - activeAgents} 待機中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">JWT認証性能</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.find(m => m.name === 'JWT認証時間')?.value.toFixed(2)}ms
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              目標: 1.44ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">処理中コンテンツ</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {multimodalContent.filter(c => c.status === 'processing').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              マルチモーダル処理中
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="layers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="layers">Context7レイヤー</TabsTrigger>
          <TabsTrigger value="agents">エージェント</TabsTrigger>
          <TabsTrigger value="performance">パフォーマンス</TabsTrigger>
          <TabsTrigger value="multimodal">マルチモーダル</TabsTrigger>
        </TabsList>

        {/* Context7 Layers Tab */}
        <TabsContent value="layers" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {layers.map((layer) => (
              <Card key={layer.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Layer {layer.id}</CardTitle>
                    {getStatusIcon(layer.status)}
                  </div>
                  <CardDescription>{layer.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>使用率</span>
                    <span>{layer.utilization}%</span>
                  </div>
                  <Progress value={layer.utilization} />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">データサイズ</p>
                      <p className="font-medium">{layer.dataSize}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">優先度</p>
                      <p className="font-medium">{layer.priority}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(layer.status)}>
                      {layer.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(layer.lastUpdated).toLocaleTimeString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card key={agent.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    {getStatusIcon(agent.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      完了タスク: {agent.tasksCompleted}
                    </span>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-2">アクセス可能レイヤー</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.layerAccess.map((layerId) => (
                        <Badge key={layerId} variant="outline" className="text-xs">
                          L{layerId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    最終活動: {new Date(agent.lastActivity).toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metrics.map((metric) => (
              <Card key={metric.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{metric.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold">
                        {metric.value.toFixed(metric.unit === 'ms' ? 2 : 1)}
                        <span className="text-lg font-normal text-gray-600 ml-1">
                          {metric.unit}
                        </span>
                      </p>
                      {metric.target && (
                        <p className="text-sm text-gray-600">
                          目標: {metric.target}{metric.unit}
                        </p>
                      )}
                    </div>
                    <TrendingUp className={`h-6 w-6 ${
                      metric.trend === 'up' ? 'text-red-500' :
                      metric.trend === 'down' ? 'text-green-500' : 'text-gray-500'
                    }`} />
                  </div>
                  
                  {metric.target && (
                    <Progress 
                      value={(metric.value / metric.target) * 100} 
                      className="mt-2"
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Multimodal Tab */}
        <TabsContent value="multimodal" className="space-y-4">
          <div className="space-y-4">
            {multimodalContent.map((content) => (
              <Card key={content.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(content.status)}
                        <Badge variant="outline" className="capitalize">
                          {content.type}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-medium">{content.filename}</p>
                        <p className="text-sm text-gray-600">{content.size}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {content.processingTime && (
                        <span className="text-sm text-gray-600">
                          {content.processingTime}ms
                        </span>
                      )}
                      <Badge className={getStatusColor(content.status)}>
                        {content.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Context7Dashboard;