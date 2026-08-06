// js/common.js - общие функции для всех инструментов Caps Game

// Базовые URL API
const CONFIG = {
    FIRESTORE_QUERY: "https://firestore.googleapis.com/v1/projects/capsgame-prod/databases/(default)/documents:runQuery",
    COLLECTIONS_API: "https://firestore.googleapis.com/v1/projects/capsgame-prod/databases/(default)/documents/Static/CapsCollections",
    STORAGE_BASE: "https://firebasestorage.googleapis.com/v0/b/capsgame-prod.appspot.com/o/",
    USERS_API: (tgId) => `https://firestore.googleapis.com/v1/projects/capsgame-prod/databases/(default)/documents/Users/${tgId}`,
    SQUADS_INFO_API: (squadId) => `https://firestore.googleapis.com/v1/projects/capsgame-prod/databases/(default)/documents/SquadsV2/${squadId}`,
    SQUADS_REQUESTS_API: (squadId) => `https://firestore.googleapis.com/v1/projects/capsgame-prod/databases/(default)/documents/SquadsV2/${squadId}/Requests`,
    SQUAD_ID: '-1002917473074',
    PAGE_SIZE: 50,
    GRADE_ORDER: ['COMMON', 'COMMON_PLUS', 'RARE', 'RARE_PLUS', 'EPIC', 'EPIC_PLUS', 'LEGEND', 'LEGEND_PLUS', 'DIAMOND'],
};

// Безопасное получение значения из Firestore fields
function getFieldValue(fields, fieldName, defaultValue = null) {
    if (!fields || !fields[fieldName]) return defaultValue;
    const field = fields[fieldName];
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return parseInt(field.integerValue);
    if (field.doubleValue !== undefined) return parseFloat(field.doubleValue);
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.timestampValue !== undefined) return field.timestampValue;
    if (field.mapValue?.fields) return field.mapValue.fields;
    if (field.arrayValue?.values) return field.arrayValue.values;
    return defaultValue;
}

// Безопасное приведение к числу
function safeNumber(value, defaultValue = 0) {
    if (value === undefined || value === null) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
}

// Экранирование HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Форматирование чисел с разделителями
function formatNumber(num) {
    return num?.toLocaleString() || '0';
}

// Форматирование даты из Firestore timestamp
function formatFirestoreDate(timestampValue) {
    if (!timestampValue) return '—';
    const date = new Date(timestampValue);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Форматирование времени
function formatTime(timestampValue) {
    if (!timestampValue) return '—';
    const date = new Date(timestampValue);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Получение класса для типа коллекции
function getTypeClass(type) {
    const classes = {
        'common': 'badge-type-common',
        'event': 'badge-type-event',
        'community': 'badge-type-community',
        'premium': 'badge-type-premium',
        'special': 'badge-type-special'
    };
    return classes[type] || 'badge-type-common';
}

// Получение эмодзи для типа коллекции
function getTypeEmoji(type) {
    const emojis = {
        'common': '📀',
        'event': '🎉',
        'community': '👥',
        'premium': '💎',
        'special': '✨'
    };
    return emojis[type] || '🎴';
}

// Загрузка списка коллекций
async function fetchCollectionsList() {
    try {
        const response = await fetch(CONFIG.COLLECTIONS_API);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (!data.fields?.collections?.arrayValue?.values) {
            return [];
        }
        
        return data.fields.collections.arrayValue.values
            .map(item => {
                const fields = item.mapValue.fields;
                const id = getFieldValue(fields, 'id');
                if (!id) return null;
                return {
                    id: id,
                    title: getFieldValue(fields, 'title', 'Без названия'),
                    status: getFieldValue(fields, 'status', 'unknown'),
                    size: getFieldValue(fields, 'size', 0),
                    supply: getFieldValue(fields, 'supply', 0),
                    used: getFieldValue(fields, 'used', 0),
                    burned: getFieldValue(fields, 'burned', 0),
                    type: getFieldValue(fields, 'type', 'common'),
                    order: getFieldValue(fields, 'order', 999),
                    releaseDate: fields.releasedAt?.timestampValue || null,
                    hasCustomDiamond: getFieldValue(fields, 'hasCustomDiamond', false),
                    isStandard: getFieldValue(fields, 'isStandard', false)
                };
            })
            .filter(c => c !== null)
            .sort((a, b) => {
                if (a.status === 'available' && b.status !== 'available') return -1;
                if (a.status !== 'available' && b.status === 'available') return 1;
                return (a.order || 0) - (b.order || 0);
            });
    } catch (err) {
        console.error('Ошибка загрузки коллекций:', err);
        return [];
    }
}

// ============= ФУНКЦИИ ДЛЯ RECRUITER =============

// Построить URL изображения
function buildImageUrl(path) {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const encodedPath = encodeURIComponent(path);
    return `${CONFIG.STORAGE_BASE}${encodedPath}?alt=media`;
}

// Загрузка профиля игрока
async function fetchPlayerProfile(tgId) {
    const apiUrl = CONFIG.USERS_API(tgId);
    const response = await fetch(apiUrl);
    if (!response.ok) {
        if (response.status === 404) throw new Error('Игрок не найден. Проверьте TG ID');
        throw new Error(`Ошибка API: ${response.status}`);
    }
    const data = await response.json();
    if (!data.fields) throw new Error('Неверный формат ответа');
    return data;
}

// Получить параметр из URL
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Получить отсортированные редкости
function getSortedGrades(gradeStats) {
    const result = [];
    for (const grade of CONFIG.GRADE_ORDER) {
        if (gradeStats[grade] > 0) {
            result.push({ grade, count: gradeStats[grade] });
        }
    }
    return result;
}

// Классы для редкостей
function getGradeClass(grade) {
    const classes = {
        'COMMON': 'grade-common',
        'COMMON_PLUS': 'grade-common-plus',
        'RARE': 'grade-rare',
        'RARE_PLUS': 'grade-rare-plus',
        'EPIC': 'grade-epic',
        'EPIC_PLUS': 'grade-epic-plus',
        'LEGEND': 'grade-legend',
        'LEGEND_PLUS': 'grade-legend-plus',
        'DIAMOND': 'grade-diamond'
    };
    return classes[grade] || 'grade-common';
}

// ============= ФУНКЦИИ ДЛЯ SQUAD-REQUESTS =============

// Загрузка информации о дворе
async function fetchSquadInfo(squadId) {
    const url = CONFIG.SQUADS_INFO_API(squadId);
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// Загрузка страницы заявок
async function fetchRequestsPage(squadId, pageToken = null) {
    let url = `${CONFIG.SQUADS_REQUESTS_API(squadId)}?pageSize=${CONFIG.PAGE_SIZE}`;
    if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return { requests: [], nextPageToken: null };
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const documents = data.documents || [];
        const nextPageToken = data.nextPageToken || null;

        const requests = documents.map(doc => {
            const fields = doc.fields || {};
            const nameParts = doc.name.split('/');
            const requestId = nameParts[nameParts.length - 1];
            const status = getFieldValue(fields, 'status', 'UNKNOWN');
            const createdAt = getFieldValue(fields, 'createdAt', null);
            const updatedAt = getFieldValue(fields, 'updatedAt', null);
            const userId = getFieldValue(fields, 'userId', requestId);

            return {
                id: requestId,
                userId: userId || requestId,
                status: status,
                createdAt: createdAt,
                updatedAt: updatedAt,
                raw: doc
            };
        });

        return { requests, nextPageToken };
    } catch (err) {
        console.error('Ошибка загрузки заявок:', err);
        throw err;
    }
}

// Загрузка всех заявок (с пагинацией)
async function fetchAllRequests(squadId) {
    let all = [];
    let pageToken = null;
    let hasMore = true;

    while (hasMore) {
        const result = await fetchRequestsPage(squadId, pageToken);
        all = all.concat(result.requests);
        pageToken = result.nextPageToken;
        hasMore = !!pageToken;
    }

    return all;
}

// ============= ФУНКЦИИ ДЛЯ FINDER =============

// Маппинг статусов фишек
const STATUS_MAP = {
    'SALE': { emoji: '💰', label: 'На продаже', color: '#22c55e' },
    'READY': { emoji: '✅', label: 'Готова', color: '#fbbf24' },
    'STAKED': { emoji: '💎', label: 'В стейкинге', color: '#3b82f6' },
    'WITHDRAWN': { emoji: '📤', label: 'Выведена', color: '#8b5cf6' },
    'BURNED': { emoji: '🔥', label: 'Сожжена', color: '#ef4444' },
    'LOCKED': { emoji: '🔒', label: 'Заблокирована', color: '#6b7280' },
    'BANNED': { emoji: '🚫', label: 'Забанена', color: '#dc2626' },
    'NFT_EDITING': { emoji: '✏️', label: 'Редактирование NFT', color: '#f59e0b' }
};

// Маппинг редкостей
const GRADE_MAP = {
    'COMMON': { label: 'Common', color: '#94a3b8' },
    'COMMON_PLUS': { label: 'Common+', color: '#94a3b8' },
    'RARE': { label: 'Rare', color: '#22c55e' },
    'RARE_PLUS': { label: 'Rare+', color: '#22c55e' },
    'EPIC': { label: 'Epic', color: '#3b82f6' },
    'EPIC_PLUS': { label: 'Epic+', color: '#3b82f6' },
    'LEGEND': { label: 'Legend', color: '#f59e0b' },
    'LEGEND_PLUS': { label: 'Legend+', color: '#f59e0b' },
    'DIAMOND': { label: 'Diamond', color: '#06b6d4' }
};

// Получить информацию о статусе
function getStatusInfo(status) {
    return STATUS_MAP[status] || { emoji: '❓', label: status || 'Неизвестно', color: '#6b7280' };
}

// Получить информацию о редкости
function getGradeInfo(grade) {
    return GRADE_MAP[grade] || { label: grade || 'Unknown', color: '#6b7280' };
}

// Поиск фишек по номеру
async function searchCapsByNumber(number) {
    const query = {
        structuredQuery: {
            from: [{ collectionId: "Caps" }],
            where: {
                fieldFilter: {
                    field: { fieldPath: "number" },
                    op: "EQUAL",
                    value: { integerValue: String(number) }
                }
            },
            limit: 200
        }
    };

    const response = await fetch(CONFIG.FIRESTORE_QUERY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
    });

    if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error('Неверный формат ответа от сервера');
    }
    return data;
}

// Показать уведомление (тост)
function showToast(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    // Можно добавить визуальный тост позже
}

// Экспортируем в глобальный объект
window.CapsTools = {
    CONFIG,
    getFieldValue,
    safeNumber,
    escapeHtml,
    formatNumber,
    formatFirestoreDate,
    formatTime,
    getTypeClass,
    getTypeEmoji,
    fetchCollectionsList,
    fetchPlayerProfile,
    fetchSquadInfo,
    fetchRequestsPage,
    fetchAllRequests,
    buildImageUrl,
    getUrlParam,
    getSortedGrades,
    getGradeClass,
    getStatusInfo,
    getGradeInfo,
    searchCapsByNumber,
    showToast,
    STATUS_MAP,
    GRADE_MAP
};