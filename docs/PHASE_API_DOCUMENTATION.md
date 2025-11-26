# Phase Management API Documentation

## 概要

Phase Management API は、プロジェクトの Phase 1-N を管理するための RESTful API です。

- **バージョン**: 1.0.0
- **ベースURL**: `/api/phases`
- **認証**: 一部のエンドポイントで必要（将来実装予定）

## データモデル

### Phase

```json
{
  "id": 1,
  "phase_number": 1,
  "name": "Phase 1: Foundation",
  "description": "基盤構築・緊急安定化",
  "status": "completed",
  "priority": 1,
  "planned_start_date": "2025-11-01",
  "planned_end_date": "2025-11-15",
  "actual_start_date": "2025-11-01",
  "actual_end_date": "2025-11-14",
  "config": {
    "objectives": ["PostgreSQL移行", "Redis統合"],
    "duration_weeks": 2
  },
  "total_kpis": 3,
  "achieved_kpis": 3,
  "total_deliverables": 5,
  "completed_deliverables": 5,
  "created_at": "2025-11-01T00:00:00Z",
  "updated_at": "2025-11-14T12:00:00Z"
}
```

### KPI

```json
{
  "id": 1,
  "phase_id": 1,
  "kpi_name": "API Response Time",
  "kpi_category": "performance",
  "description": "平均APIレスポンス時間",
  "target_value": "200",
  "actual_value": "180",
  "unit": "ms",
  "status": "achieved",
  "measured_at": "2025-11-14T12:00:00Z"
}
```

### Deliverable

```json
{
  "id": 1,
  "phase_id": 1,
  "title": "PostgreSQL統合",
  "description": "SQLiteからPostgreSQLへの移行完了",
  "deliverable_type": "database",
  "status": "completed",
  "priority": 1,
  "due_date": "2025-11-10",
  "completed_at": "2025-11-09T15:00:00Z"
}
```

## エンドポイント一覧

### Phase管理

#### 1. 全Phase一覧取得

```http
GET /api/phases
```

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| status | string | No | フィルタリング用ステータス (planned/active/completed/cancelled) |
| include_kpis | boolean | No | KPI情報を含める |
| include_deliverables | boolean | No | 成果物情報を含める |

**レスポンス例**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "phase_number": 1,
      "name": "Phase 1: Foundation",
      "status": "completed",
      "total_deliverables": 5,
      "completed_deliverables": 5
    }
  ]
}
```

#### 2. 現在のPhase取得

```http
GET /api/phases/current
```

**レスポンス例**

```json
{
  "success": true,
  "data": {
    "id": 2,
    "phase_number": 2,
    "name": "Phase 2: Core Features",
    "status": "active",
    "kpis": [...],
    "deliverables": [...],
    "progress": {...}
  }
}
```

#### 3. Phase詳細取得

```http
GET /api/phases/:id
```

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| id | integer | Phase ID |

**レスポンス例**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "phase_number": 1,
    "name": "Phase 1: Foundation",
    "description": "基盤構築・緊急安定化",
    "status": "completed",
    "kpis": [...],
    "deliverables": [...],
    "progress": {...}
  }
}
```

#### 4. Phase作成

```http
POST /api/phases
```

**リクエストボディ**

```json
{
  "phase_number": 6,
  "name": "Phase 6: New Feature",
  "description": "新機能実装",
  "status": "planned",
  "priority": 1,
  "planned_start_date": "2025-12-01",
  "planned_end_date": "2025-12-15",
  "config": {
    "objectives": ["新機能A", "新機能B"],
    "duration_weeks": 2
  }
}
```

**レスポンス例**

```json
{
  "success": true,
  "message": "Phase created successfully",
  "data": {
    "id": 6,
    "phase_number": 6,
    "name": "Phase 6: New Feature",
    "status": "planned"
  }
}
```

#### 5. Phase更新

```http
PUT /api/phases/:id
```

**リクエストボディ**

```json
{
  "name": "Updated Phase Name",
  "description": "Updated description",
  "status": "active",
  "priority": 2
}
```

#### 6. Phase開始

```http
POST /api/phases/:id/start
```

**レスポンス例**

```json
{
  "success": true,
  "message": "Phase Phase 2: Core Features を開始しました",
  "data": {
    "id": 2,
    "status": "active",
    "actual_start_date": "2025-11-21T00:00:00Z"
  }
}
```

#### 7. Phase完了

```http
POST /api/phases/:id/complete
```

**レスポンス例**

```json
{
  "success": true,
  "message": "Phase Phase 2: Core Features が完了しました",
  "data": {...},
  "completion_report": {
    "can_complete": true,
    "reasons": [],
    "deliverables": {
      "completed": 10,
      "total": 10
    },
    "kpis": {
      "achieved": 8,
      "total": 10
    }
  }
}
```

#### 8. KPI更新

```http
PUT /api/phases/:id/kpi
```

**リクエストボディ**

```json
{
  "kpi_name": "API Response Time",
  "kpi_category": "performance",
  "description": "平均APIレスポンス時間",
  "target_value": "200",
  "actual_value": "180",
  "unit": "ms",
  "status": "achieved"
}
```

**レスポンス例**

```json
{
  "success": true,
  "message": "KPI updated successfully",
  "data": {
    "id": 1,
    "phase_id": 2,
    "kpi_name": "API Response Time",
    "status": "achieved"
  }
}
```

#### 9. Phaseレポート生成

```http
GET /api/phases/:id/report
```

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| format | string | No | レポート形式 (json/pdf/csv) ※現在はjsonのみ |

**レスポンス例**

```json
{
  "success": true,
  "data": {
    "phase": {...},
    "schedule": {
      "planned_start": "2025-11-15",
      "planned_end": "2025-12-05",
      "actual_start": "2025-11-15",
      "actual_end": null,
      "duration_days": 20,
      "is_delayed": false
    },
    "kpis": {
      "total": 10,
      "achieved": 8,
      "achievement_rate": "80.00",
      "details": [...]
    },
    "deliverables": {
      "total": 15,
      "completed": 12,
      "completion_rate": "80.00",
      "details": [...]
    },
    "progress": {...},
    "summary": {
      "overall_health": "good",
      "recommendations": [
        "KPI達成率を向上させる施策が必要です"
      ]
    },
    "generated_at": "2025-11-21T12:00:00Z"
  }
}
```

### 進捗管理

#### 10. 全体進捗取得

```http
GET /api/phases/progress/overall
```

**レスポンス例**

```json
{
  "success": true,
  "data": {
    "total_phases": 5,
    "completed_phases": 2,
    "active_phases": 1,
    "planned_phases": 2,
    "phase_completion_rate": "40.00",
    "total_deliverables": 50,
    "completed_deliverables": 35,
    "deliverable_completion_rate": "70.00",
    "phases": [...],
    "updated_at": "2025-11-21T12:00:00Z"
  }
}
```

#### 11. Phase進捗取得

```http
GET /api/phases/progress/:phaseId
```

**レスポンス例**

```json
{
  "success": true,
  "data": {
    "phase_id": 2,
    "phase_name": "Phase 2: Core Features",
    "current_progress": {
      "progress_percentage": 75.00,
      "tasks_total": 15,
      "tasks_completed": 12
    },
    "deliverables": {
      "total": 15,
      "completed": 12,
      "completion_rate": "80.00"
    },
    "kpis": {
      "total": 10,
      "achieved": 8
    }
  }
}
```

#### 12. 進捗更新

```http
POST /api/phases/progress/update
```

**リクエストボディ**

```json
{
  "phase_id": 2,
  "progress_percentage": 80,
  "tasks_total": 15,
  "tasks_completed": 12,
  "tasks_in_progress": 2,
  "tasks_blocked": 1,
  "notes": "順調に進行中"
}
```

**レスポンス例**

```json
{
  "success": true,
  "message": "Progress updated successfully",
  "data": {
    "id": 5,
    "phase_id": 2,
    "progress_percentage": 80.00,
    "recorded_at": "2025-11-21T12:00:00Z"
  }
}
```

### Phase移行

#### 13. Phase移行チェック

```http
POST /api/phases/transition/check
```

**リクエストボディ**

```json
{
  "from_phase_id": 2,
  "to_phase_id": 3
}
```

**レスポンス例**

```json
{
  "success": true,
  "data": {
    "phase_completed": true,
    "all_deliverables_done": true,
    "kpis_achieved": true,
    "next_phase_ready": true,
    "can_transition": true
  }
}
```

#### 14. Phase移行実行

```http
POST /api/phases/transition/execute
```

**リクエストボディ**

```json
{
  "from_phase_id": 2,
  "to_phase_id": 3,
  "notes": "Phase 2 完了、Phase 3 開始"
}
```

**レスポンス例**

```json
{
  "success": true,
  "message": "Phase transition executed successfully",
  "data": {
    "transition": {
      "id": 3,
      "from_phase_id": 2,
      "to_phase_id": 3,
      "status": "completed"
    },
    "readiness_check": {...},
    "success": true
  }
}
```

#### 15. Phase移行履歴

```http
GET /api/phases/transition/history
```

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| limit | integer | No | 取得件数 (default: 10) |

**レスポンス例**

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 3,
      "from_phase_id": 2,
      "to_phase_id": 3,
      "from_phase_name": "Phase 2: Core Features",
      "to_phase_name": "Phase 3: Advanced Features",
      "status": "completed",
      "completed_at": "2025-11-21T12:00:00Z"
    }
  ]
}
```

### システム

#### 16. ヘルスチェック

```http
GET /api/phases/health
```

**レスポンス例**

```json
{
  "success": true,
  "status": "healthy",
  "data": {
    "total_phases": 5,
    "current_phase": {
      "id": 2,
      "name": "Phase 2: Core Features",
      "status": "active"
    },
    "system_status": "operational",
    "timestamp": "2025-11-21T12:00:00Z"
  }
}
```

## エラーレスポンス

すべてのエラーは以下の形式で返されます:

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

### HTTPステータスコード

| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | 不正なリクエスト |
| 404 | リソースが見つからない |
| 500 | サーバーエラー |
| 503 | サービス利用不可 |

## 使用例

### cURL

```bash
# 全Phase一覧取得
curl -X GET http://localhost:5000/api/phases

# 現在のPhase取得
curl -X GET http://localhost:5000/api/phases/current

# Phase作成
curl -X POST http://localhost:5000/api/phases \
  -H "Content-Type: application/json" \
  -d '{
    "phase_number": 6,
    "name": "Phase 6: New Feature",
    "description": "新機能実装"
  }'

# KPI更新
curl -X PUT http://localhost:5000/api/phases/2/kpi \
  -H "Content-Type: application/json" \
  -d '{
    "kpi_name": "API Response Time",
    "target_value": "200",
    "actual_value": "180",
    "unit": "ms"
  }'

# Phase移行チェック
curl -X POST http://localhost:5000/api/phases/transition/check \
  -H "Content-Type: application/json" \
  -d '{
    "from_phase_id": 2,
    "to_phase_id": 3
  }'
```

### JavaScript (Fetch API)

```javascript
// 全Phase一覧取得
const getPhases = async () => {
  const response = await fetch('http://localhost:5000/api/phases');
  const data = await response.json();
  console.log(data);
};

// Phase作成
const createPhase = async () => {
  const response = await fetch('http://localhost:5000/api/phases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phase_number: 6,
      name: 'Phase 6: New Feature',
      description: '新機能実装'
    })
  });
  const data = await response.json();
  console.log(data);
};

// 進捗更新
const updateProgress = async () => {
  const response = await fetch('http://localhost:5000/api/phases/progress/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phase_id: 2,
      progress_percentage: 80,
      tasks_total: 15,
      tasks_completed: 12
    })
  });
  const data = await response.json();
  console.log(data);
};
```

## ベストプラクティス

1. **キャッシング**: 頻繁にアクセスされるエンドポイント（/current, /overall）はキャッシュされます（5分間）

2. **エラーハンドリング**: すべてのリクエストで `success` フィールドを確認してください

3. **進捗更新**: Phase が active の間、定期的に進捗を更新してください

4. **Phase移行**: 移行前に必ず `/transition/check` で条件を確認してください

5. **レポート生成**: 大量のデータを含むため、適切なタイミングで呼び出してください

## サポート

問題が発生した場合は、以下を確認してください:

1. PostgreSQL が正常に動作しているか
2. Redis が利用可能か（オプション）
3. データベーススキーマが最新か（マイグレーション実行）

## 変更履歴

### v1.0.0 (2025-11-21)

- Phase管理API完全実装
- Phase 1-N 対応の汎用設計
- 16エンドポイント実装
- PostgreSQL統合
- Redis キャッシング対応
