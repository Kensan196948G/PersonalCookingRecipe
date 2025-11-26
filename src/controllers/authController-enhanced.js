/**
 * 強化版認証コントローラー - PersonalCookingRecipe Phase 2 Week 1
 * Redisキャッシング統合版
 *
 * @author Backend API Developer
 * @version 2.0.0
 */

const User = require('../models/User');
const { generateToken, generateRefreshToken, blacklistToken } = require('../middleware/unifiedAuth');
const { ERROR_CODES, createSuccessResponse, createErrorResponse } = require('../utils/errorCodes');
const { cacheService } = require('../services/cacheService');

/**
 * ユーザー登録
 * キャッシング: なし（新規作成のみ）
 */
exports.register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        // ユーザー存在確認
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(ERROR_CODES.USER_ALREADY_EXISTS.status).json(
                createErrorResponse(ERROR_CODES.USER_ALREADY_EXISTS)
            );
        }

        // ユーザー作成
        const user = await User.create({ username, email, password });

        // トークン生成
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            username: user.username
        };
        const accessToken = generateToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // JWT キャッシング
        await cacheService.cacheJWT(user.id, accessToken, tokenPayload);

        // ユーザープロファイル キャッシング
        await cacheService.cacheUserProfile(user.id, {
            id: user.id,
            username: user.username,
            email: user.email
        });

        res.status(201).json(
            createSuccessResponse({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                },
                accessToken,
                refreshToken
            }, 'User registered successfully')
        );

    } catch (error) {
        console.error('Registration error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};

/**
 * ログイン
 * Strategy: Cache-Aside (JWT + ユーザープロファイル)
 * TTL: 1時間
 */
exports.login = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const { email, password } = req.body;

        // ユーザー検索
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(ERROR_CODES.USER_INVALID_CREDENTIALS.status).json(
                createErrorResponse(ERROR_CODES.USER_INVALID_CREDENTIALS)
            );
        }

        // パスワード検証
        const isValid = await User.validatePassword(password, user.password);
        if (!isValid) {
            return res.status(ERROR_CODES.USER_INVALID_CREDENTIALS.status).json(
                createErrorResponse(ERROR_CODES.USER_INVALID_CREDENTIALS)
            );
        }

        // トークン生成
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            username: user.username
        };
        const accessToken = generateToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // JWT キャッシング（TTL: 1時間）
        await cacheService.cacheJWT(user.id, accessToken, tokenPayload);

        // ユーザープロファイル キャッシング（TTL: 30分）
        await cacheService.cacheUserProfile(user.id, {
            id: user.id,
            username: user.username,
            email: user.email
        });

        const responseTime = Date.now() - startTime;
        console.log(`Login completed in ${responseTime}ms (JWT cached)`);

        res.set('X-Cache', 'MISS');
        res.set('X-Auth-Cache', 'SET');
        res.json(
            createSuccessResponse({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                },
                accessToken,
                refreshToken,
                performance: {
                    responseTime: `${responseTime}ms`,
                    cached: false
                }
            }, 'Login successful')
        );

    } catch (error) {
        console.error('Login error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};

/**
 * プロファイル取得
 * Strategy: Cache-Aside
 * TTL: 30分
 */
exports.getProfile = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const userId = req.user.id;

        // キャッシュ確認
        let user = await cacheService.getCachedUserProfile(userId);
        let fromCache = false;

        if (user) {
            // キャッシュヒット
            fromCache = true;
            console.log(`Profile Cache HIT: User ${userId}`);
        } else {
            // キャッシュミス: DBから取得
            user = await User.findById(userId);

            if (!user) {
                return res.status(ERROR_CODES.USER_NOT_FOUND.status).json(
                    createErrorResponse(ERROR_CODES.USER_NOT_FOUND)
                );
            }

            // キャッシュに保存
            await cacheService.cacheUserProfile(userId, {
                id: user.id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            });

            console.log(`Profile Cache MISS: User ${userId}`);
        }

        const responseTime = Date.now() - startTime;

        res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
        res.json(
            createSuccessResponse({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                },
                performance: {
                    responseTime: `${responseTime}ms`,
                    cached: fromCache
                }
            })
        );

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};

/**
 * プロファイル更新
 * Strategy: Write-Through（DB更新 + キャッシュ更新）
 */
exports.updateProfile = async (req, res, next) => {
    try {
        const { username, email } = req.body;
        const userId = req.user.id;

        // DB更新
        const updated = await User.update(userId, { username, email });

        if (!updated) {
            return res.status(ERROR_CODES.USER_NOT_FOUND.status).json(
                createErrorResponse(ERROR_CODES.USER_NOT_FOUND)
            );
        }

        // キャッシュ無効化（Write-Through戦略）
        await cacheService.invalidateUserProfile(userId);
        await cacheService.invalidateUserJWTs(userId); // JWTも無効化
        await cacheService.invalidateDashboard(userId); // ダッシュボードも無効化

        // 新しいプロファイルをキャッシュ
        const user = await User.findById(userId);
        await cacheService.cacheUserProfile(userId, {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });

        console.log(`Profile updated and cache refreshed: User ${userId}`);

        res.json(
            createSuccessResponse({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            }, 'Profile updated successfully')
        );

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};

/**
 * パスワード変更
 * キャッシング: JWT無効化のみ
 */
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // ユーザー取得
        const user = await User.findById(userId);
        if (!user) {
            return res.status(ERROR_CODES.USER_NOT_FOUND.status).json(
                createErrorResponse(ERROR_CODES.USER_NOT_FOUND)
            );
        }

        // 現在のパスワード検証
        const fullUser = await User.findByEmail(user.email);
        const isValid = await User.validatePassword(currentPassword, fullUser.password);
        if (!isValid) {
            return res.status(ERROR_CODES.USER_INVALID_CREDENTIALS.status).json(
                createErrorResponse(
                    ERROR_CODES.USER_INVALID_CREDENTIALS,
                    'Current password is incorrect'
                )
            );
        }

        // パスワード更新
        await User.updatePassword(userId, newPassword);

        // 全JWT無効化（セキュリティ対策）
        await cacheService.invalidateUserJWTs(userId);

        console.log(`Password changed and all JWTs invalidated: User ${userId}`);

        res.json(
            createSuccessResponse(null, 'Password changed successfully. Please login again.')
        );

    } catch (error) {
        console.error('Change password error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};

/**
 * ログアウト
 * キャッシング: JWT無効化
 */
exports.logout = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const token = req.token;

        // トークンをブラックリストに追加
        if (token) {
            blacklistToken(token);

            // JWT キャッシュ無効化
            await cacheService.invalidateJWT(userId, token);
        }

        console.log(`Logout completed: User ${userId}`);

        res.json(
            createSuccessResponse(null, 'Logout successful')
        );

    } catch (error) {
        console.error('Logout error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};

/**
 * リフレッシュトークン
 * 将来実装予定
 */
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(ERROR_CODES.AUTH_NO_TOKEN.status).json(
                createErrorResponse(ERROR_CODES.AUTH_NO_TOKEN, 'Refresh token is required')
            );
        }

        // TODO: リフレッシュトークンの検証と新トークン生成
        // 統一認証ミドルウェアで実装予定

        res.status(501).json(
            createErrorResponse(
                ERROR_CODES.INTERNAL_SERVER_ERROR,
                'Refresh token functionality coming soon'
            )
        );

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};

/**
 * キャッシュ統計取得（開発/管理用）
 */
exports.getCacheStats = async (req, res, next) => {
    try {
        const stats = await cacheService.getStats();

        res.json(
            createSuccessResponse({
                cache: stats
            }, 'Cache statistics retrieved')
        );

    } catch (error) {
        console.error('Get cache stats error:', error);
        res.status(ERROR_CODES.INTERNAL_SERVER_ERROR.status).json(
            createErrorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, error.message)
        );
    }
};
