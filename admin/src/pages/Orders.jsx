import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    DeleteOutlined, 
    ReloadOutlined, 
    DownOutlined, 
    RightOutlined,
    CarOutlined,
    ShopOutlined
} from '@ant-design/icons';

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState({}); // Храним ID раскрытых заказов

    // Одновременная загрузка заказов и статусов
    const fetchData = async () => {
        setLoading(true);
        try {
            const [ordersResponse, statusesResponse] = await Promise.all([
                supabase.from('orders').select('*').order('created_at', { ascending: false }),
                supabase.from('order_statuses').select('*').order('sort_order')
            ]);

            if (ordersResponse.error) throw ordersResponse.error;
            if (statusesResponse.error) throw statusesResponse.error;

            setOrders(ordersResponse.data || []);
            setStatuses(statusesResponse.data || []);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert('Не удалось загрузить заказы. Проверьте консоль.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Смена статуса заказа
    const handleStatusChange = async (orderId, newStatusId) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status_id: parseInt(newStatusId) })
                .eq('id', orderId);
                
            if (error) throw error;
            
            setOrders(orders.map(o => o.id === orderId ? { ...o, status_id: parseInt(newStatusId) } : o));
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            alert('Не удалось обновить статус');
        }
    };

    // Удаление заказа
    const handleDelete = async (orderId, shortId) => {
        if (!window.confirm(`🚨 Точно отменить и удалить заказ #${shortId}?`)) return;

        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) throw error;
            setOrders(orders.filter(o => o.id !== orderId));
        } catch (error) {
            console.error('Ошибка удаления:', error);
            alert('Не удалось удалить заказ');
        }
    };

    // Раскрытие/закрытие деталей заказа
    const toggleRow = (orderId) => {
        setExpandedRows(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    };

    // Цвета для статусов (цикличная палитра для красоты)
    const getStatusColor = (statusId) => {
        const colors = ['#D97736', '#f39c12', '#3498db', '#2ecc71', '#95a5a6'];
        return colors[(statusId - 1) % colors.length] || '#E8C396';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Список заказов</h1>
                <button 
                    onClick={fetchData}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#D97736', border: '1px solid #D97736', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
                >
                    <ReloadOutlined spin={loading} /> Обновить
                </button>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8C396', boxShadow: '0 4px 15px rgba(92, 58, 33, 0.05)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Загрузка заказов...</div>
                ) : orders.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Нет активных заказов 🎉</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#FAF3E8', borderBottom: '2px solid #E8C396' }}>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21', width: '40px' }}></th>
                                <th style={{ padding: '16px 10px', fontWeight: '900', color: '#5C3A21' }}>ID / Дата</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Покупатель</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Доставка</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Сумма</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Статус</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21', textAlign: 'center' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => {
                                const shortId = o.id.substring(0, 6).toUpperCase();
                                const isExpanded = expandedRows[o.id];
                                const statusColor = getStatusColor(o.status_id);
                                const buyerName = o.user_name || `Юзер #${o.user_id.toString().substring(0, 4)}`;

                                return (
                                    <React.Fragment key={o.id}>
                                        <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid rgba(232, 195, 150, 0.3)', backgroundColor: isExpanded ? '#fcfaf7' : 'white', transition: '0.2s' }}>
                                            
                                            {/* Кнопка раскрытия */}
                                            <td style={{ padding: '16px 10px 16px 20px', cursor: 'pointer', color: '#D97736' }} onClick={() => toggleRow(o.id)}>
                                                {isExpanded ? <DownOutlined /> : <RightOutlined />}
                                            </td>

                                            {/* Дата и ID */}
                                            <td style={{ padding: '16px 10px' }}>
                                                <div style={{ fontWeight: '900', fontSize: '15px' }}>#{shortId}</div>
                                                <div style={{ fontSize: '12px', color: '#8B5E3C' }}>
                                                    {new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>

                                            {/* Покупатель */}
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{buyerName}</div>
                                                <a href={`https://t.me/user?id=${o.user_id}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#3498db', textDecoration: 'none' }}>
                                                    Написать в TG 💬
                                                </a>
                                            </td>

                                            {/* Доставка */}
                                            <td style={{ padding: '16px 20px', fontSize: '13px' }}>
                                                {o.delivery_type === 'delivery' ? (
                                                    <div style={{ color: '#5C3A21' }}><CarOutlined style={{ color: '#D97736', marginRight: '5px' }}/> Курьер<br/><span style={{ fontSize: '11px', color: '#8B5E3C' }}>{o.address || 'Без адреса'}</span></div>
                                                ) : (
                                                    <div style={{ color: '#5C3A21', fontWeight: 'bold' }}><ShopOutlined style={{ color: '#2ecc71', marginRight: '5px' }}/> Самовывоз</div>
                                                )}
                                            </td>

                                            {/* Сумма */}
                                            <td style={{ padding: '16px 20px', fontWeight: '900', color: '#D97736', fontSize: '16px' }}>
                                                {o.total_price} р.
                                            </td>

                                            {/* Статус */}
                                            <td style={{ padding: '16px 20px' }}>
                                                <select 
                                                    value={o.status_id} 
                                                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                                                    style={{ 
                                                        padding: '8px 12px', borderRadius: '8px', border: `2px solid ${statusColor}`, color: statusColor, fontWeight: 'bold', backgroundColor: 'white', outline: 'none', cursor: 'pointer'
                                                    }}
                                                >
                                                    {statuses.map(st => (
                                                        (st.is_active || st.id === o.status_id) && 
                                                        <option key={st.id} value={st.id}>{st.label}</option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Действия */}
                                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                <button 
                                                    onClick={() => handleDelete(o.id, shortId)}
                                                    style={{ background: 'transparent', border: 'none', color: '#FF3B30', fontSize: '18px', cursor: 'pointer', opacity: 0.8 }}
                                                    title="Отменить заказ"
                                                >
                                                    <DeleteOutlined />
                                                </button>
                                            </td>
                                        </tr>

                                        {/* РАСКРЫВАЮЩИЙСЯ СОСТАВ ЗАКАЗА */}
                                        {isExpanded && (
                                            <tr style={{ backgroundColor: '#fcfaf7', borderBottom: '1px solid rgba(232, 195, 150, 0.3)' }}>
                                                <td></td>
                                                <td colSpan="6" style={{ padding: '0 20px 20px 10px' }}>
                                                    <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '12px', border: '1px dashed #E8C396' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8B5E3C', marginBottom: '10px', textTransform: 'uppercase' }}>Состав заказа:</div>
                                                        {Object.keys(o.items).map(key => {
                                                            const item = o.items[key];
                                                            const p = item.product;
                                                            const seriesName = (p.series && p.series !== "—") ? p.series : p.manufacturer;
                                                            return (
                                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(232, 195, 150, 0.1)', fontSize: '14px', color: '#5C3A21' }}>
                                                                    <div>
                                                                        <b>{seriesName}</b> — {p.flavor} {p.strength !== '—' && `(${p.strength})`}
                                                                    </div>
                                                                    <div style={{ fontWeight: 'bold' }}>{item.qty} шт.</div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
