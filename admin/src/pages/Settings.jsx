import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    SaveOutlined, 
    SettingOutlined, 
    ClockCircleOutlined, 
    CarOutlined, 
    DollarOutlined, 
    LockOutlined 
} from '@ant-design/icons';

export default function Settings() {
    const [config, setConfig] = useState(null);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Конвертер даты из БД (ISO) в формат инпута (YYYY-MM-DDThh:mm)
    const formatDateForInput = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        // Корректируем часовой пояс
        const tzOffset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
        return localISOTime;
    };

    // Загрузка настроек и статусов
    const fetchData = async () => {
        setLoading(true);
        try {
            const [configRes, statusesRes] = await Promise.all([
                supabase.from('config').select('*').eq('id', 1).single(),
                supabase.from('order_statuses').select('*').order('sort_order')
            ]);

            if (configRes.error) throw configRes.error;
            if (statusesRes.error) throw statusesRes.error;

            setConfig(configRes.data);
            setStatuses(statusesRes.data || []);
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
            alert('Не удалось загрузить настройки');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Универсальный обработчик изменений в инпутах
    const handleChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    // Обработчик для JSON (наценки по категориям)
    const handleCategoryMarginChange = (category, value) => {
        setConfig(prev => ({
            ...prev,
            category_margins: {
                ...prev.category_margins,
                [category]: parseFloat(value) || 0
            }
        }));
    };

    // Сохранение в базу
    const handleSave = async () => {
        setSaving(true);
        try {
            // Подготавливаем даты обратно в ISO формат
            const payload = {
                ...config,
                open_date: config.open_date ? new Date(config.open_date).toISOString() : null,
                close_date: config.close_date ? new Date(config.close_date).toISOString() : null
            };

            const { error } = await supabase
                .from('config')
                .update(payload)
                .eq('id', 1);

            if (error) throw error;
            alert('✅ Настройки успешно сохранены!');
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Не удалось сохранить настройки');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !config) {
        return <div style={{ padding: '40px', color: '#8B5E3C', fontWeight: 'bold' }}>Загрузка конфигурации...</div>;
    }

    // Стили для карточек и инпутов
    const cardStyle = { backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8C396', padding: '24px', boxShadow: '0 4px 15px rgba(92, 58, 33, 0.05)', marginBottom: '24px' };
    const cardTitleStyle = { margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold', color: '#D97736', display: 'flex', alignItems: 'center', gap: '10px' };
    const inputGroupStyle = { marginBottom: '16px' };
    const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#5C3A21' };
    const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E8C396', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', color: '#5C3A21' };

    return (
        <div style={{ paddingBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Настройки магазина</h1>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#D97736', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer', fontWeight: 'bold', transition: '0.2s', fontSize: '16px', boxShadow: '0 4px 10px rgba(217, 119, 54, 0.3)' }}
                >
                    <SaveOutlined /> {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* ЛЕВАЯ КОЛОНКА */}
                <div>
                    {/* КАРТОЧКА: Управление Дропом */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><ClockCircleOutlined /> Расписание работы (Дроп)</h2>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Открытие магазина:</label>
                            <input 
                                type="datetime-local" 
                                style={inputStyle} 
                                value={formatDateForInput(config.open_date)} 
                                onChange={(e) => handleChange('open_date', e.target.value)}
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Закрытие магазина (стоп заказов):</label>
                            <input 
                                type="datetime-local" 
                                style={inputStyle} 
                                value={formatDateForInput(config.close_date)} 
                                onChange={(e) => handleChange('close_date', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* КАРТОЧКА: Доставка */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><CarOutlined /> Доставка</h2>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Порог бесплатной доставки (руб):</label>
                            <input 
                                type="number" 
                                style={inputStyle} 
                                value={config.free_delivery_threshold} 
                                onChange={(e) => handleChange('free_delivery_threshold', parseInt(e.target.value))}
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Стоимость курьера (руб):</label>
                            <input 
                                type="number" 
                                style={inputStyle} 
                                value={config.delivery_cost} 
                                onChange={(e) => handleChange('delivery_cost', parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА */}
                <div>
                    {/* КАРТОЧКА: Финансы и наценки */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><DollarOutlined /> Наценки на товары</h2>
                        <div style={{ ...inputGroupStyle, paddingBottom: '16px', borderBottom: '1px solid #FAF3E8' }}>
                            <label style={labelStyle}>Базовый коэффициент (по умолчанию):</label>
                            <input 
                                type="number" 
                                step="0.1"
                                style={inputStyle} 
                                value={config.default_margin} 
                                onChange={(e) => handleChange('default_margin', parseFloat(e.target.value))}
                            />
                        </div>
                        
                        <div style={{ marginTop: '16px' }}>
                            <label style={{ ...labelStyle, color: '#8B5E3C' }}>Индивидуальные коэффициенты категорий:</label>
                            {config.category_margins && Object.keys(config.category_margins).map(category => (
                                <div key={category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 'bold' }}>{category}</span>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        style={{ ...inputStyle, width: '100px', textAlign: 'center' }} 
                                        value={config.category_margins[category]} 
                                        onChange={(e) => handleCategoryMarginChange(category, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* КАРТОЧКА: Блокировка редактирования */}
                    <div style={cardStyle}>
                        <h2 style={cardTitleStyle}><LockOutlined /> Ограничения</h2>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Блокировать редактирование заказа клиентом при статусе:</label>
                            <select 
                                style={inputStyle}
                                value={config.edit_lock_status}
                                onChange={(e) => handleChange('edit_lock_status', parseInt(e.target.value))}
                            >
                                {statuses.map(st => (
                                    <option key={st.id} value={st.id}>{st.label}</option>
                                ))}
                            </select>
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#8B5E3C' }}>
                                Как только вы переведете заказ в этот статус (или выше), покупатель больше не сможет изменить его состав в боте.
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}