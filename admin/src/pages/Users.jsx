import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { DeleteOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';

export default function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Функция загрузки пользователей из БД
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false }); // Новые сверху
            
            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            alert('Не удалось загрузить пользователей. Проверьте консоль.');
        } finally {
            setLoading(false);
        }
    };

    // Загружаем данные при открытии страницы
    useEffect(() => {
        fetchUsers();
    }, []);

    // Смена статуса
    const handleStatusChange = async (userId, newStatus) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ status: newStatus })
                .eq('id', userId);
                
            if (error) throw error;
            
            // Обновляем статус в локальном стейте без перезагрузки всей таблицы
            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            alert('Не удалось обновить статус');
        }
    };

    // Удаление пользователя
    const handleDelete = async (userId, userName) => {
        if (!window.confirm(`🚨 Точно удалить пользователя "${userName}" навсегда?\nВместе с ним могут удалиться все его заказы.`)) return;

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;
            
            // Убираем удаленного юзера из таблицы
            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            console.error('Ошибка удаления:', error);
            alert('Не удалось удалить пользователя');
        }
    };

    // Цвета для разных статусов
    const getStatusColor = (status) => {
        const colors = {
            pending: '#f39c12',    // Оранжевый
            approved: '#2ecc71',   // Зеленый
            admin: '#9b59b6',      // Фиолетовый
            developer: '#3498db',  // Синий
            blocked: '#FF3B30'     // Красный
        };
        return colors[status] || '#8B5E3C';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Пользователи</h1>
                <button 
                    onClick={fetchUsers}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#D97736', border: '1px solid #D97736', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
                >
                    <ReloadOutlined spin={loading} /> Обновить
                </button>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8C396', boxShadow: '0 4px 15px rgba(92, 58, 33, 0.05)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Загрузка базы пользователей...</div>
                ) : users.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>База пользователей пуста</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#FAF3E8', borderBottom: '2px solid #E8C396' }}>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Пользователь</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Источник</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Регистрация</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Доступ (Статус)</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21', textAlign: 'center' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => {
                                const statusColor = getStatusColor(u.status);
                                return (
                                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(232, 195, 150, 0.3)', transition: '0.2s' }}>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#F3E9DC', color: '#D97736', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                                    <UserOutlined />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{u.full_name}</div>
                                                    <div style={{ fontSize: '12px', color: '#8B5E3C' }}>
                                                        <a href={`https://t.me/${u.username}`} target="_blank" rel="noreferrer" style={{ color: '#3498db', textDecoration: 'none' }}>@{u.username}</a> 
                                                        <span style={{ margin: '0 4px', opacity: 0.5 }}>|</span> 
                                                        ID: {u.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#5C3A21' }}>
                                            {u.source || <span style={{ opacity: 0.5 }}>Не указан</span>}
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#8B5E3C' }}>
                                            {new Date(u.created_at).toLocaleDateString('ru-RU')}
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <select 
                                                value={u.status} 
                                                onChange={(e) => handleStatusChange(u.id, e.target.value)}
                                                style={{ 
                                                    padding: '8px 12px', 
                                                    borderRadius: '8px', 
                                                    border: `2px solid ${statusColor}`, 
                                                    color: statusColor, 
                                                    fontWeight: 'bold', 
                                                    backgroundColor: 'white',
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="pending">⏳ Ожидает апрува</option>
                                                <option value="approved">✅ Принят (Покупатель)</option>
                                                <option value="admin">👑 Администратор</option>
                                                <option value="developer">💻 Разработчик</option>
                                                <option value="blocked">🚫 Заблокирован</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <button 
                                                onClick={() => handleDelete(u.id, u.full_name)}
                                                style={{ background: 'transparent', border: 'none', color: '#FF3B30', fontSize: '18px', cursor: 'pointer', opacity: 0.8 }}
                                                title="Удалить пользователя"
                                            >
                                                <DeleteOutlined />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}