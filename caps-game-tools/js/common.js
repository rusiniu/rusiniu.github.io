// js/common.js - общие функции для всех инструментов Caps Game

// Базовые URL API
const CONFIG = {
    FIRESTORE_QUERY: "https://firestore.googleapis.com/v1/projects/capsgame-prod/databases/(default)/documents:runQuery",
    COLLECTIONS_API: "https://firestore.googleapis.com/v1/projects/capsgame-prod/databases/(default)/documents/Static/CapsCollections",
    STORAGE_BASE: "https://firebasestorage.googleapis.com/v0/b/capsgame-prod.appspot.com/o/"
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
    return defaultValue;
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

// Загрузка списка коллекций (общая для market и collections)
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

// ============= НОВЫЕ ФУНКЦИИ ДЛЯ FINDER =============

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

// Построить URL изображения
function buildImageUrl(path) {
    if (!path) return null;
    const encodedPath = encodeURIComponent(path);
    return `${CONFIG.STORAGE_BASE}${encodedPath}?alt=media`;
}

// Показать уведомление (тост) — можно расширить
function showToast(message, type = 'info') {
    console.log(`[${type}] ${message}`);
}

// Экспортируем если нужно (для модулей, но пока просто глобально)
window.CapsTools = {
    CONFIG,
    getFieldValue,
    escapeHtml,
    formatNumber,
    formatFirestoreDate,
    getTypeClass,
    getTypeEmoji,
    fetchCollectionsList,
    showToast,
    STATUS_MAP,
    GRADE_MAP,
    getStatusInfo,
    getGradeInfo,
    buildImageUrl
};