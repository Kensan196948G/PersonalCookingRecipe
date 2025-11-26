/**
 * Phase Management System - Database Migration Script
 *
 * このスクリプトは Phase 管理用のテーブルを PostgreSQL に作成します
 *
 * 実行方法:
 * node scripts/migrate-phase-tables.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL接続設定
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'recipe_db',
    user: process.env.DB_USER || 'recipe_user',
    password: process.env.DB_PASSWORD,
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Phase Management System - データベースマイグレーション開始...\n');

        // マイグレーションファイル読み込み
        const migrationPath = path.join(__dirname, '../src/migrations/001-create-phase-tables.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 マイグレーションファイル読み込み完了');
        console.log(`   ファイル: ${migrationPath}\n`);

        // マイグレーション実行
        console.log('⚙️  マイグレーション実行中...');
        await client.query(migrationSQL);

        console.log('\n✅ マイグレーション完了!\n');

        // 作成されたテーブル確認
        console.log('📊 作成されたテーブル:');
        const tablesResult = await client.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename LIKE 'phase%'
            ORDER BY tablename;
        `);

        tablesResult.rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ${row.tablename}`);
        });

        // ビュー確認
        console.log('\n📈 作成されたビュー:');
        const viewsResult = await client.query(`
            SELECT viewname
            FROM pg_views
            WHERE schemaname = 'public'
            AND viewname LIKE 'v_%phase%'
            ORDER BY viewname;
        `);

        viewsResult.rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ${row.viewname}`);
        });

        // 初期データ確認
        console.log('\n📋 初期Phase データ:');
        const phasesResult = await client.query(`
            SELECT phase_number, name, status
            FROM phases
            ORDER BY phase_number;
        `);

        phasesResult.rows.forEach((row) => {
            console.log(`   Phase ${row.phase_number}: ${row.name} [${row.status}]`);
        });

        console.log('\n🎉 Phase Management System の準備が完了しました!\n');
        console.log('次のステップ:');
        console.log('  1. サーバーを起動: npm run dev');
        console.log('  2. APIをテスト: curl http://localhost:5000/api/phases/current');
        console.log('  3. ドキュメント確認: backend/docs/PHASE_API_DOCUMENTATION.md\n');

    } catch (error) {
        console.error('\n❌ マイグレーションエラー:', error.message);
        console.error('\n詳細:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// マイグレーション実行
runMigration();
