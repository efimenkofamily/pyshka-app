import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    ReloadOutlined, 
    PictureOutlined
} from '@ant-design/icons';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [seriesImages, setSeriesImages] = useState([]);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Фильтры
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAvailability, setFilterAvailability] = useState('all');
    const [filterPhoto, setFilterPhoto] = useState('all');
    
    const [uploadingFor, setUploadingFor] = useState(null);
    const [previewImage, setPreviewImage] = useState(null); // Состояние для увеличенного фото

    const fetchData = async () => {
        setLoading(true);
        try {
            const [productsRes, configRes, imagesRes] = await Promise.all([
                supabase.from('products').select('*').order('category'),
                supabase.from('config').select('*').eq('id', 1).single(),
                supabase.from('series_images').select('*')
            ]);

            if (productsRes.error) throw productsRes.error;
            if (configRes.error) throw configRes.error;
            if (imagesRes.error) throw imagesRes.error;

            setProducts(productsRes.data || []);
            setConfig(configRes.data);
            setSeriesImages(imagesRes.data || []);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert('Не удалось загрузить данные. Проверьте консоль.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_SIZE = 500;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/webp', 0.7);
                };
            };
            reader.onerror = error => reject(error);
        });
    };

    const handlePhotoUpload = async (event, manufacturer, series) => {
        const file = event.target.files[0];
        if (!file) return;

        const safeSeries = series === '—' ? 'default_series' : series;
        const uploadId = `${manufacturer}_${safeSeries}`;
        
        setUploadingFor(uploadId);

        try {
            const compressedBlob = await compressImage(file);
            
            // 🚀 ИСПРАВЛЕНИЕ: Генерируем 100% безопасное имя файла без кириллицы
            const randomString = Math.random().toString(36).substring(2, 10);
            const fileName = `photo_${Date.now()}_${randomString}.webp`;
            const filePath = `series/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product_images')
                .upload(filePath, compressedBlob, { contentType: 'image/webp', upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product_images')
                .getPublicUrl(filePath);

            const existingRecord = seriesImages.find(img => img.manufacturer === manufacturer && img.series === series);

            if (existingRecord) {
                const { error: updateError } = await supabase
                    .from('series_images')
                    .update({ image_url: publicUrl })
                    .eq('id', existingRecord.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('series_images')
                    .insert([{ manufacturer, series, image_url: publicUrl }]);
                if (insertError) throw insertError;
            }

            await fetchData();

        } catch (error) {
            console.error('Ошибка загрузки фото:', error);
            alert(`Ошибка при загрузке фото: ${error.message}`);
        } finally {
            setUploadingFor(null);
            event.target.value = '';
        }
    };

    const calculatePricing = (product) => {
        let rawCost = product.price_10;
        if (typeof rawCost === 'string') {
            rawCost = rawCost.replace(/[^0-9.,]/g, '').replace(',', '.');
        }
        const costPrice = parseFloat(rawCost) || 0;
        
        if (!config) return { salePrice: 0, profit: 0 };

        const margin = (config.category_margins && config.category_margins[product.category]) 
            || config.default_margin 
            || 1.0;

        const salePrice = Math.round(costPrice * margin);
        const profit = salePrice - costPrice;

        return { salePrice, profit };
    };

    const hasPhoto = (manufacturer, series) => {
        return seriesImages.some(img => img.manufacturer === manufacturer && img.series === series);
    };

    const filteredProducts = products.filter(p => {
        const searchString = `${p.manufacturer} ${p.series} ${p.flavor} ${p.category}`.toLowerCase();
        if (searchQuery && !searchString.includes(searchQuery.toLowerCase())) return false;

        const isAvailable = p.availability === 'есть';
        if (filterAvailability === 'available' && !isAvailable) return false;
        if (filterAvailability === 'unavailable' && isAvailable) return false;

        const photoExists = hasPhoto(p.manufacturer, p.series);
        if (filterPhoto === 'with_photo' && !photoExists) return false;
        if (filterPhoto === 'no_photo' && photoExists) return false;

        return true;
    });

    return (
        <div>
            {/* Модальное окно для увеличенного просмотра фото */}
            {previewImage && (
                <div 
                    style={{ 
                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}
                    onClick={() => setPreviewImage(null)}
                >
                    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={previewImage} 
                            alt="Preview" 
                            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                        />
                        <button 
                            onClick={() => setPreviewImage(null)}
                            style={{
                                position: 'absolute', top: '-15px', right: '-15px',
                                background: '#e74c3c', color: 'white', border: 'none',
                                borderRadius: '50%', width: '36px', height: '36px',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '18px',
                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Товары и маржа</h1>
                    <button 
                        onClick={fetchData}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#D97736', border: '1px solid #D97736', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        <ReloadOutlined spin={loading} /> Обновить
                    </button>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', backgroundColor: '#FAF3E8', padding: '15px', borderRadius: '12px', border: '1px solid #E8C396' }}>
                    <input 
                        type="text"
                        placeholder="Поиск..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C396', flex: 1, outline: 'none' }}
                    />
                    
                    <select 
                        value={filterAvailability} 
                        onChange={(e) => setFilterAvailability(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C396', outline: 'none', backgroundColor: 'white' }}
                    >
                        <option value="all">Все товары</option>
                        <option value="available">Только в наличии</option>
                        <option value="unavailable">Нет в наличии</option>
                    </select>

                    <select 
                        value={filterPhoto} 
                        onChange={(e) => setFilterPhoto(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E8C396', outline: 'none', backgroundColor: 'white' }}
                    >
                        <option value="all">Любое фото</option>
                        <option value="no_photo">Без фото ❌</option>
                        <option value="with_photo">С фото ✅</option>
                    </select>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8C396', boxShadow: '0 4px 15px rgba(92, 58, 33, 0.05)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Загрузка каталога...</div>
                ) : filteredProducts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Товары не найдены</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#FAF3E8', borderBottom: '2px solid #E8C396' }}>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Фото линейки</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Наименование / Вкус</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Наличие</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Закупка</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Реализация</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((p, index) => {
                                const { salePrice, profit } = calculatePricing(p);
                                const isAvailable = p.availability === 'есть';
                                const safeSeries = p.series === '—' ? 'default_series' : p.series;
                                const uploadId = `${p.manufacturer}_${safeSeries}`;
                                const isUploading = uploadingFor === uploadId;
                                const photoRecord = seriesImages.find(img => img.manufacturer === p.manufacturer && img.series === p.series);

                                return (
                                    <tr key={index} style={{ borderBottom: '1px solid rgba(232, 195, 150, 0.3)' }}>
                                        <td style={{ padding: '16px 20px', width: '150px' }}>
                                            {photoRecord ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2ecc71', fontWeight: 'bold', fontSize: '12px' }}>
                                                    <img 
                                                        src={photoRecord.image_url} 
                                                        alt="preview" 
                                                        onClick={() => setPreviewImage(photoRecord.image_url)} // Клик по миниатюре
                                                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e0e0e0', cursor: 'zoom-in' }} 
                                                        title="Нажмите для увеличения"
                                                    />
                                                    <label style={{ cursor: 'pointer', color: '#3498db', textDecoration: 'underline' }}>
                                                        Заменить
                                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e, p.manufacturer, p.series)} disabled={isUploading} />
                                                    </label>
                                                </div>
                                            ) : (
                                                <label style={{ 
                                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', 
                                                    backgroundColor: isUploading ? '#f5f5f5' : '#FFFBF5', 
                                                    border: '1px dashed #D97736', borderRadius: '6px', cursor: isUploading ? 'wait' : 'pointer',
                                                    color: '#D97736', fontSize: '12px', fontWeight: 'bold', width: 'fit-content'
                                                }}>
                                                    {isUploading ? <ReloadOutlined spin /> : <PictureOutlined />}
                                                    {isUploading ? 'Грузим...' : 'Добавить фото'}
                                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e, p.manufacturer, p.series)} disabled={isUploading} />
                                                </label>
                                            )}
                                        </td>

                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#5C3A21' }}>
                                                {p.manufacturer} <span style={{ color: '#8B5E3C', fontSize: '14px' }}>({p.series !== "—" ? p.series : p.manufacturer})</span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#A0A0A0' }}>
                                                {p.flavor} {p.strength !== '—' && `| ${p.strength}`}
                                            </div>
                                        </td>

                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', backgroundColor: isAvailable ? '#e8f8f5' : '#fdedec', color: isAvailable ? '#2ecc71' : '#e74c3c' }}>
                                                {p.availability}
                                            </span>
                                        </td>

                                        <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#5C3A21' }}>
                                            {p.price_10} ₽
                                        </td>

                                        <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#D97736' }}>
                                            {salePrice} ₽ <span style={{ color: '#2ecc71', fontSize: '12px', marginLeft: '5px' }}>(+{profit})</span>
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