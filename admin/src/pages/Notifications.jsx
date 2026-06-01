import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    BellOutlined, 
    CheckOutlined, 
    SaveOutlined,
    LoadingOutlined
} from '@ant-design/icons';

export default function Notifications() {
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Загрузка матрицы из таблицы config (id = 1)
  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('config')
        .select('notification_matrix')
        .eq('id', 1)
        .single();

      if (error) throw error;
      setMatrix(data?.notification_matrix || {});
    } catch (error) {
      console.error('Ошибка загрузки матрицы уведомлений:', error);
      alert('Не удалось загрузить настройки уведомлений.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  // Переключение тумблера локально в стейте (Исправлено: Глубокое копирование)
  const handleMatrixToggle = (eventName, role) => {
    setMatrix(prev => {
      // 🔥 Создаем полную независимую копию всего дерева JSON
      const newMatrix = JSON.parse(JSON.stringify(prev || {}));
      
      if (!newMatrix[eventName]) newMatrix[eventName] = {};
      
      // Переключаем значение (если было true/undefined -> станет false, если false -> true)
      newMatrix[eventName][role] = !newMatrix[eventName][role];
      
      return newMatrix;
    });
  };

  // Сохранение измененной матрицы в Supabase
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('config')
        .update({ notification_matrix: matrix })
        .eq('id', 1);

      if (error) throw error;
      alert('Настройки уведомлений успешно сохранены!');
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert('Не удалось сохранить настройки.');
    } finally {
      setSaving(false);
    }
  };

  const EVENT_NAMES = {
    'NEW_USER_PENDING': 'Новая заявка в клуб',
    'NEW_ORDER': 'Новый заказ оформлен',
    'NEW_ORDER_STAFF': 'Новый заказ оформлен (Администрации)', 
    'STORE_OPENED': 'Открытие магазина (Дроп)',
    'STORE_CLOSED': 'Закрытие магазина',
    'ORDER_STATUS_CHANGED': 'Смена статуса заказа'
  };

  const ROLES = [
    { key: 'developer', label: 'Разработчикам' },
    { key: 'admin', label: 'Админам' },
    { key: 'approved', label: 'Клиентам' }
  ];

  // Стили в тон твоей админки
  const containerStyle = { padding: '30px', fontFamily: 'sans-serif' };
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
  const titleStyle = { margin: 0, fontSize: '28px', fontWeight: '900', color: '#5C3A21' };
  const saveBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#D97736', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 10px rgba(217, 119, 54, 0.2)' };
  const cardStyle = { padding: '24px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8C396', boxShadow: '0 4px 10px rgba(92, 58, 33, 0.05)' };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontSize: '18px' }}><LoadingOutlined /> Загрузка матрицы уведомлений...</div>;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Управление уведомлениями</h1>
        <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
          {saving ? <LoadingOutlined /> : <SaveOutlined />}
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: '18px', color: '#5C3A21', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BellOutlined /> Маршрутизация Telegram уведомлений
        </h2>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ecf0f1' }}>
                <th style={{ padding: '12px 16px', color: '#7f8c8d', fontSize: '13px', textTransform: 'uppercase' }}>Системное событие</th>
                {ROLES.map(role => (
                  <th key={role.key} style={{ padding: '12px 16px', color: '#7f8c8d', fontSize: '13px', textTransform: 'uppercase', textAlign: 'center' }}>
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(EVENT_NAMES).map(([eventKey, eventLabel], idx) => (
                <tr key={eventKey} style={{ borderBottom: idx !== Object.keys(EVENT_NAMES).length - 1 ? '1px solid #f0f2f5' : 'none' }}>
                  <td style={{ padding: '16px', fontWeight: 'bold', color: '#2c3e50', fontSize: '14px' }}>
                    {eventLabel}
                    <div style={{ fontSize: '11px', color: '#95a5a6', fontWeight: 'normal', marginTop: '4px' }}>{eventKey}</div>
                  </td>
                  {ROLES.map(role => {
                    const isActive = matrix?.[eventKey]?.[role.key] || false;
                    return (
                      <td key={role.key} style={{ padding: '16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleMatrixToggle(eventKey, role.key)}
                          style={{
                            width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                            backgroundColor: isActive ? '#2ecc71' : '#f8f9fa',
                            color: isActive ? 'white' : '#bdc3c7',
                            transition: 'all 0.2s', 
                            boxShadow: isActive ? '0 4px 10px rgba(46, 204, 113, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.05)'
                          }}
                        >
                          {isActive ? <CheckOutlined /> : '-'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '20px', fontSize: '13px', color: '#8B5E3C', lineHeight: '1.5' }}>
          💡 <b>Памятка разработчика:</b> Выключайте чекбоксы в колонке "Клиентам", когда проводите технические работы или тесты статусов на проде. Это предотвратит отправку спама реальным пользователям клуба.
        </div>
      </div>
    </div>
  );
}