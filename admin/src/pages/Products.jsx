import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    ReloadOutlined, 
    InboxOutlined, 
    DollarOutlined, 
    PercentageOutlined, 
    ArrowUpOutlined 
} from '@ant-design/icons';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Загрузка товаров и конфига с наценками
    const fetchData = async () => {
        setLoading(true);
        try {
            const [productsRes, configRes] = await Promise.all([
                supabase.from('products').select('*').order('category'),
                supabase.from('config').select('*').eq('id', 1).single()
            ]);

            if (productsRes.error) throw productsRes.error;
            if (configRes.error) throw configRes.error;

            setProducts(productsRes.data || []);
            setConfig(configRes.data);
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
            alert('Не удалось загрузить товары. Проверьте консоль.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Обновленная функция расчета цены реализации и прибыли с защитой от букв в БД
    const calculatePricing = (product) => {
        let rawCost = product.price_10;
        
        // Если пришла строка (например "9.5р" или "950 руб"), вытаскиваем только цифры и точки
        if (typeof rawCost === 'string') {
            // Убираем всё кроме цифр и точек/запятых
            rawCost = rawCost.replace(/[^0-9.,]/g, '').replace(',', '.');
        }
        
        const costPrice = parseFloat(rawCost) || 0; // Теперь тут точно чистое число
        
        if (!config) return { salePrice: 0, profit: 0 };

        // Ищем индивидуальную наценку категории, если её нет — берем базовую
        const margin = (config.category_margins && config.category_margins[product.category]) 
            || config.default_margin 
            || 1.0;

        const salePrice = Math.round(costPrice * margin);
        const profit = salePrice - costPrice;

        return { salePrice, profit };
    };

    // Фильтрация товаров по поисковому запросу
    const filteredProducts = products.filter(p => {
        const searchString = `${p.manufacturer} ${p.series} ${p.flavor} ${p.category}`.toLowerCase();
        return searchString.includes(searchQuery.toLowerCase());
    });

    return (
        <div>
            {/* Хедер страницы с поиском */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Товары и маржа</h1>
                    <input 
                        type="text"
                        placeholder="Поиск по бренду, вкусу или категории..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ 
                            padding: '10px 16px', 
                            borderRadius: '8px', 
                            border: '1px solid #E8C396', 
                            width: '300px', 
                            outline: 'none',
                            color: '#5C3A21'
                        }}
                    />
                </div>
                <button 
                    onClick={fetchData}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#D97736', border: '1px solid #D97736', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
                >
                    <ReloadOutlined spin={loading} /> Обновить
                </button>
            </div>

            {/* Карточки быстрой статистики */}
            {!loading && config && (
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                    <div style={{ backgroundColor: '#FAF3E8', padding: '15px 20px', borderRadius: '12px', border: '1px solid #E8C396', flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#8B5E3C', fontWeight: 'bold' }}>ВСЕГО НАИМЕНОВАНИЙ</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#5C3A21' }}>{filteredProducts.length} позиций</div>
                    </div>
                    <div style={{ backgroundColor: '#FAF3E8', padding: '15px 20px', borderRadius: '12px', border: '1px solid #E8C396', flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#8B5E3C', fontWeight: 'bold' }}>БАЗОВАЯ НАЦЕНКА МАГАЗИНА</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#D97736' }}>x{config.default_margin}</div>
                    </div>
                </div>
            )}

            {/* Таблица товаров */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8C396', boxShadow: '0 4px 15px rgba(92, 58, 33, 0.05)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Загрузка каталога товаров...</div>
                ) : filteredProducts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Товары не найдены</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#FAF3E8', borderBottom: '2px solid #E8C396' }}>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Категория</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Наименование / Вкус</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Наличие</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}><DollarOutlined /> Закупка</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}><PercentageOutlined /> Реализация</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21', color: '#2ecc71' }}><ArrowUpOutlined /> Прибыль (Маржа)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((p, index) => {
                                const { salePrice, profit } = calculatePricing(p);
                                const seriesName = (p.series && p.series !== "—") ? p.series : p.manufacturer;
                                const isAvailable = p.availability === 'есть';

                                return (
                                    <tr key={index} style={{ borderBottom: '1px solid rgba(232, 195, 150, 0.3)', transition: '0.2s' }}>
                                        {/* Категория */}
                                        <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 'bold', color: '#8B5E3C' }}>
                                            {p.category}
                                        </td>

                                        {/* Название */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <InboxOutlined style={{ color: '#D97736' }} />
                                                <div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#5C3A21' }}>
                                                        {p.manufacturer} <span style={{ color: '#8B5E3C', fontSize: '14px' }}>({seriesName})</span>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: '#A0A0A0' }}>
                                                        {p.flavor} {p.strength !== '—' && `| ${p.strength}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Наличие */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                borderRadius: '6px', 
                                                fontSize: '12px', 
                                                fontWeight: 'bold',
                                                backgroundColor: isAvailable ? '#e8f8f5' : '#fdedec',
                                                color: isAvailable ? '#2ecc71' : '#e74c3c'
                                            }}>
                                                {p.availability}
                                            </span>
                                        </td>

                                        {/* Закупочная цена */}
                                        <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#5C3A21' }}>
                                            {p.price_10} ₽
                                        </td>

                                        {/* Цена реализации */}
                                        <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#D97736' }}>
                                            {salePrice} ₽
                                        </td>

                                        {/* Прибыль */}
                                        <td style={{ padding: '16px 20px', fontWeight: '900', color: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.03)', fontSize: '15px' }}>
                                            +{profit} ₽
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