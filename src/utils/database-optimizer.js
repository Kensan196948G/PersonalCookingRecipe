/**
 * PostgreSQLクエリ最適化・インデックス戦略
 * PersonalCookingRecipe Phase 2b パフォーマンス最適化
 */

const { getConnection } = require('../config/database-postgresql');

class DatabaseOptimizer {
    constructor() {
        this.performanceThresholds = {
            query: 100,      // 100ms超過で警告
            connection: 50,  // 50ms超過で警告
            index: 200       // 200ms超過で警告
        };
    }

    // インデックス最適化戦略
    async optimizeIndexes() {
        const connection = await getConnection();
        
        try {
            console.log('🔧 PostgreSQLインデックス最適化開始...');

            // 1. 高頻度検索フィールドのインデックス作成/最適化
            const indexQueries = [
                // レシピタイトル全文検索インデックス（GiST）
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_title_gin 
                 ON recipes USING GIN (to_tsvector('english', title))`,
                
                // レシピ複合インデックス（ユーザー+作成日）
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_user_created 
                 ON recipes(user_id, created_at DESC)`,
                
                // レシピ複合インデックス（カテゴリ+作成日）
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_category_created 
                 ON recipes(category_id, created_at DESC) WHERE category_id IS NOT NULL`,
                
                // レシピ複合インデックス（難易度+作成日）
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_difficulty_created 
                 ON recipes(difficulty_level, created_at DESC) WHERE difficulty_level IS NOT NULL`,
                
                // レシピ評価インデックス（高評価順表示用）
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipe_ratings_recipe_rating 
                 ON recipe_ratings(recipe_id, rating DESC)`,
                
                // ユーザー認証高速化
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_hash 
                 ON users USING HASH (email)`,
                
                // JSONBフィールドインデックス（材料検索）
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_ingredients_gin 
                 ON recipes USING GIN (ingredients)`,
                
                // JSONBフィールドインデックス（手順検索）
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipes_instructions_gin 
                 ON recipes USING GIN (instructions)`
            ];

            for (const query of indexQueries) {
                const startTime = process.hrtime.bigint();
                await connection.query(query);
                const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
                
                console.log(`✅ インデックス作成完了: ${duration.toFixed(3)}ms`);
                
                if (duration > this.performanceThresholds.index) {
                    console.warn(`⚠️ インデックス作成時間超過: ${duration.toFixed(3)}ms`);
                }
            }

            // 2. 統計情報更新
            await this.updateStatistics();

            // 3. インデックス使用状況分析
            await this.analyzeIndexUsage();

            console.log('✅ PostgreSQLインデックス最適化完了');

        } catch (error) {
            console.error('❌ インデックス最適化エラー:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 統計情報更新
    async updateStatistics() {
        const connection = await getConnection();
        
        try {
            console.log('📊 PostgreSQL統計情報更新中...');
            
            const startTime = process.hrtime.bigint();
            
            // 全テーブルの統計情報更新
            await connection.query('ANALYZE');
            
            const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
            console.log(`✅ 統計情報更新完了: ${duration.toFixed(3)}ms`);
            
        } catch (error) {
            console.error('❌ 統計情報更新エラー:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }

    // クエリ最適化
    async optimizeQueries() {
        const connection = await getConnection();
        
        try {
            console.log('⚡ PostgreSQLクエリ最適化開始...');

            // 1. 接続プール設定確認
            await this.validateConnectionPool();

            // 2. 重い処理のクエリ最適化テスト
            await this.testOptimizedQueries();

            // 3. バキューム・リインデックス（必要に応じて）
            await this.performMaintenance();

            console.log('✅ PostgreSQLクエリ最適化完了');

        } catch (error) {
            console.error('❌ クエリ最適化エラー:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 最適化されたクエリのテスト
    async testOptimizedQueries() {
        const connection = await getConnection();
        
        try {
            const testQueries = [
                // 高速レシピ検索（タイトル）
                {
                    name: 'レシピタイトル検索',
                    query: `
                        SELECT r.*, c.name as category_name,
                               AVG(rt.rating) as avg_rating,
                               COUNT(rt.rating) as rating_count
                        FROM recipes r
                        LEFT JOIN categories c ON r.category_id = c.id
                        LEFT JOIN recipe_ratings rt ON r.id = rt.recipe_id
                        WHERE to_tsvector('english', r.title) @@ plainto_tsquery('english', $1)
                        GROUP BY r.id, c.name
                        ORDER BY r.created_at DESC
                        LIMIT 20
                    `,
                    params: ['chicken']
                },
                
                // ユーザー別レシピ高速取得
                {
                    name: 'ユーザー別レシピ取得',
                    query: `
                        SELECT r.*, c.name as category_name,
                               AVG(rt.rating) as avg_rating,
                               COUNT(rt.rating) as rating_count
                        FROM recipes r
                        LEFT JOIN categories c ON r.category_id = c.id
                        LEFT JOIN recipe_ratings rt ON r.id = rt.recipe_id
                        WHERE r.user_id = $1
                        GROUP BY r.id, c.name
                        ORDER BY r.created_at DESC
                        LIMIT $2 OFFSET $3
                    `,
                    params: [1, 20, 0]
                },
                
                // 人気レシピ取得（評価順）
                {
                    name: '人気レシピ取得',
                    query: `
                        SELECT r.*, c.name as category_name,
                               AVG(rt.rating) as avg_rating,
                               COUNT(rt.rating) as rating_count
                        FROM recipes r
                        LEFT JOIN categories c ON r.category_id = c.id
                        INNER JOIN recipe_ratings rt ON r.id = rt.recipe_id
                        WHERE rt.created_at >= NOW() - INTERVAL '7 days'
                        GROUP BY r.id, c.name
                        HAVING COUNT(rt.rating) >= 3
                        ORDER BY AVG(rt.rating) DESC, COUNT(rt.rating) DESC
                        LIMIT 20
                    `
                }
            ];

            for (const testQuery of testQueries) {
                const startTime = process.hrtime.bigint();
                
                const result = await connection.query(testQuery.query, testQuery.params || []);
                
                const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
                
                console.log(`⚡ ${testQuery.name}: ${duration.toFixed(3)}ms (${result.rows.length}行)`);
                
                if (duration > this.performanceThresholds.query) {
                    console.warn(`⚠️ ${testQuery.name}が遅い: ${duration.toFixed(3)}ms`);
                }
            }
            
        } catch (error) {
            console.error('❌ クエリテストエラー:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }

    // 接続プール設定確認
    async validateConnectionPool() {
        const connection = await getConnection();
        
        try {
            const poolStats = await connection.query(`
                SELECT 
                    count(*) as total_connections,
                    count(*) filter (where state = 'active') as active_connections,
                    count(*) filter (where state = 'idle') as idle_connections
                FROM pg_stat_activity 
                WHERE datname = current_database()
            `);
            
            console.log('📊 接続プール状況:', poolStats.rows[0]);
            
        } catch (error) {
            console.error('❌ 接続プール確認エラー:', error.message);
        } finally {
            connection.release();
        }
    }

    // インデックス使用状況分析
    async analyzeIndexUsage() {
        const connection = await getConnection();
        
        try {
            const indexUsage = await connection.query(`
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_tup_read,
                    idx_tup_fetch,
                    idx_scan
                FROM pg_stat_user_indexes 
                WHERE schemaname = 'public'
                ORDER BY idx_scan DESC
            `);
            
            console.log('📈 インデックス使用状況:');
            indexUsage.rows.forEach(row => {
                console.log(`  ${row.tablename}.${row.indexname}: ${row.idx_scan}回使用`);
            });
            
        } catch (error) {
            console.error('❌ インデックス使用状況確認エラー:', error.message);
        } finally {
            connection.release();
        }
    }

    // メンテナンス処理
    async performMaintenance() {
        const connection = await getConnection();
        
        try {
            console.log('🧹 PostgreSQLメンテナンス開始...');
            
            // VACUUM ANALYZE（軽量版）
            const startTime = process.hrtime.bigint();
            await connection.query('VACUUM ANALYZE');
            const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
            
            console.log(`✅ VACUUM ANALYZE完了: ${duration.toFixed(3)}ms`);
            
        } catch (error) {
            console.error('❌ メンテナンスエラー:', error.message);
        } finally {
            connection.release();
        }
    }

    // パフォーマンス診断
    async runPerformanceDiagnostics() {
        const connection = await getConnection();
        
        try {
            console.log('🔍 PostgreSQLパフォーマンス診断開始...');

            // 1. 遅いクエリ確認
            const slowQueries = await connection.query(`
                SELECT 
                    query,
                    mean_exec_time,
                    calls,
                    total_exec_time,
                    min_exec_time,
                    max_exec_time
                FROM pg_stat_statements 
                WHERE mean_exec_time > 100
                ORDER BY mean_exec_time DESC 
                LIMIT 10
            `);

            if (slowQueries.rows.length > 0) {
                console.log('⚠️ 遅いクエリ検出:');
                slowQueries.rows.forEach(row => {
                    console.log(`  平均${row.mean_exec_time.toFixed(2)}ms: ${row.query.substring(0, 100)}...`);
                });
            } else {
                console.log('✅ 遅いクエリは検出されませんでした');
            }

            // 2. テーブルサイズ確認
            const tableSizes = await connection.query(`
                SELECT 
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY size_bytes DESC
            `);

            console.log('📊 テーブルサイズ:');
            tableSizes.rows.forEach(row => {
                console.log(`  ${row.tablename}: ${row.size}`);
            });

            return {
                timestamp: new Date().toISOString(),
                slow_queries: slowQueries.rows.length,
                table_sizes: tableSizes.rows,
                recommendations: this.generateRecommendations(slowQueries.rows, tableSizes.rows)
            };

        } catch (error) {
            console.error('❌ パフォーマンス診断エラー:', error.message);
            return { error: error.message };
        } finally {
            connection.release();
        }
    }

    // パフォーマンス改善推奨事項生成
    generateRecommendations(slowQueries, tableSizes) {
        const recommendations = [];
        
        if (slowQueries.length > 0) {
            recommendations.push('遅いクエリが検出されました。クエリの最適化またはインデックスの追加を検討してください。');
        }
        
        const largeTables = tableSizes.filter(table => table.size_bytes > 100 * 1024 * 1024); // 100MB
        if (largeTables.length > 0) {
            recommendations.push('大きなテーブルが検出されました。パーティショニングやアーカイブを検討してください。');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('パフォーマンスは良好です。現在の最適化戦略を継続してください。');
        }
        
        return recommendations;
    }
}

// シングルトンインスタンス
const databaseOptimizer = new DatabaseOptimizer();

module.exports = {
    databaseOptimizer,
    DatabaseOptimizer
};