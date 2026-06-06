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
    const [filterCategory, setFilterCategory] = useState('all'); // Новый фильтр категорий

    // Автоматически собираем все уникальные категории из загруженных товаров
    const uniqueCategories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
    
    const [uploadingFor, setUploadingFor] = useState(null);
    const [previewImage, setPreviewImage] = useState(null); // Состояние для увеличенного фото

    // --- СОСТОЯНИЯ ДЛЯ УМНОЙ МОДАЛКИ ФОТО ---
    const [photoModalConfig, setPhotoModalConfig] = useState({ isOpen: false, product: null });
    const [photoTab, setPhotoTab] = useState('search'); // 'search' или 'upload'
    const [photoSearchQuery, setPhotoSearchQuery] = useState('');

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

    const openPhotoModal = (product) => {
        setPhotoModalConfig({ isOpen: true, product });
        setPhotoSearchQuery(product.series !== '—' ? product.series : product.manufacturer);
        setPhotoTab('search');
    };

    const closePhotoModal = () => {
        setPhotoModalConfig({ isOpen: false, product: null });
        setPhotoSearchQuery('');
    };

    const handleLinkExistingPhoto = async (imageUrl) => {
        const { product } = photoModalConfig;
        if (!product) return;
        
        const uploadId = `${product.manufacturer}_${product.series !== '—' ? product.series : 'default_series'}`;
        setUploadingFor(uploadId);
        closePhotoModal();

        try {
            const existingRecord = seriesImages.find(img => img.manufacturer === product.manufacturer && img.series === product.series);

            if (existingRecord) {
                const { error } = await supabase.from('series_images').update({ image_url: imageUrl }).eq('id', existingRecord.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('series_images').insert([{ manufacturer: product.manufacturer, series: product.series, image_url: imageUrl }]);
                if (error) throw error;
            }
            await fetchData();
        } catch (error) {
            console.error('Ошибка привязки фото:', error);
            alert('Ошибка при привязке фото: ' + error.message);
        } finally {
            setUploadingFor(null);
        }
    };

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

        // НОВАЯ ПРОВЕРКА КАТЕГОРИИ
        if (filterCategory !== 'all' && p.category !== filterCategory) return false;

        return true;
    });

    return (
        <div>
            {/* МОДАЛЬНОЕ ОКНО ДЛЯ ПРИВЯЗКИ ФОТО (УМНЫЙ ПОИСК) */}
            {photoModalConfig.isOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={closePhotoModal}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, color: '#5C3A21', fontSize: '20px', fontWeight: '900' }}>
                                Фото: {photoModalConfig.product?.manufacturer} {photoModalConfig.product?.series !== '—' ? photoModalConfig.product?.series : ''}
                            </h2>
                            <button onClick={closePhotoModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#A0A0A0' }}>✕</button>
                        </div>

                        {/* Вкладки переключения */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <button onClick={() => setPhotoTab('search')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: photoTab === 'search' ? '2px solid #D97736' : '1px solid #E8C396', backgroundColor: photoTab === 'search' ? '#FAF3E8' : 'white', color: photoTab === 'search' ? '#D97736' : '#A0A0A0', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                                🗄 Выбрать из базы
                            </button>
                            <button onClick={() => setPhotoTab('upload')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: photoTab === 'upload' ? '2px solid #D97736' : '1px solid #E8C396', backgroundColor: photoTab === 'upload' ? '#FAF3E8' : 'white', color: photoTab === 'upload' ? '#D97736' : '#A0A0A0', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                                📤 Загрузить новое
                            </button>
                        </div>

                        {/* Содержимое: Поиск по базе */}
                        {photoTab === 'search' && (
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <input 
                                    type="text" 
                                    placeholder="Поиск по производителю или линейке..." 
                                    value={photoSearchQuery} 
                                    onChange={(e) => setPhotoSearchQuery(e.target.value)} 
                                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #E8C396', marginBottom: '15px', outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                                />
                                <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', paddingRight: '5px' }}>
                                    {seriesImages
                                        .filter(img => (img.series && img.series.toLowerCase().includes(photoSearchQuery.toLowerCase())) || (img.manufacturer && img.manufacturer.toLowerCase().includes(photoSearchQuery.toLowerCase())))
                                        // Оставляем только уникальные картинки, чтобы не плодить дубли
                                        .filter((v, i, a) => a.findIndex(t => (t.image_url === v.image_url)) === i)
                                        .map((img, index) => (
                                            <div 
                                                key={index} 
                                                onClick={() => handleLinkExistingPhoto(img.image_url)} 
                                                style={{ border: '1px solid #E8C396', borderRadius: '8px', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s' }}
                                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                <img src={img.image_url} alt="photo" style={{ width: '100%', height: '100px', objectFit: 'contain', backgroundColor: '#ffffff', padding: '5px' }} />
                                                <div style={{ padding: '8px', fontSize: '11px', fontWeight: 'bold', textAlign: 'center', color: '#5C3A21', width: '100%', boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', backgroundColor: '#FAF3E8', borderTop: '1px solid #E8C396' }}>
                                                    {img.series}
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {seriesImages.filter(img => (img.series && img.series.toLowerCase().includes(photoSearchQuery.toLowerCase())) || (img.manufacturer && img.manufacturer.toLowerCase().includes(photoSearchQuery.toLowerCase()))).length === 0 && (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#A0A0A0', padding: '20px' }}>Фотографии не найдены. Попробуйте изменить запрос.</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Содержимое: Загрузка нового файла */}
                        {photoTab === 'upload' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', border: '2px dashed #D97736', borderRadius: '12px', backgroundColor: '#FFFBF5', flex: 1 }}>
                                <PictureOutlined style={{ fontSize: '48px', color: '#D97736', marginBottom: '15px' }} />
                                <p style={{ color: '#5C3A21', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>Загрузите новую фотографию с устройства.<br/>Она автоматически оптимизируется.</p>
                                <label style={{ padding: '12px 24px', backgroundColor: '#D97736', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
                                    Выбрать файл
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        style={{ display: 'none' }} 
                                        onChange={(e) => {
                                            closePhotoModal();
                                            handlePhotoUpload(e, photoModalConfig.product.manufacturer, photoModalConfig.product.series);
                                        }} 
                                    />
                                </label>
                            </div>
                        )}

                    </div>
                </div>
            )}

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
                        value={filterCategory} 
                        onChange={(e) => setFilterCategory(e.target.value)}
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E8C396', outline: 'none', color: '#5C3A21', fontWeight: 'bold', backgroundColor: '#FFFBF5', cursor: 'pointer' }}
                    >
                        <option value="all">📦 Все категории</option>
                        {uniqueCategories.filter(cat => cat !== 'all').map((cat, index) => (
                            <option key={index} value={cat}>{cat}</option>
                        ))}
                    </select>

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
                                                <button 
                                                    onClick={() => !isUploading && openPhotoModal(p)}
                                                    disabled={isUploading}
                                                    style={{ 
                                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', 
                                                        backgroundColor: isUploading ? '#f5f5f5' : '#FFFBF5', 
                                                        border: '1px dashed #D97736', borderRadius: '6px', cursor: isUploading ? 'wait' : 'pointer',
                                                        color: '#D97736', fontSize: '12px', fontWeight: 'bold', width: 'fit-content',
                                                        outline: 'none'
                                                    }}>
                                                    {isUploading ? <ReloadOutlined spin /> : <PictureOutlined />}
                                                    {isUploading ? 'Грузим...' : 'Добавить фото'}
                                                </button>
                                            )}
                                        </td>

                                        <td style={{ padding: '16px 20px' }}>
                                            {/* Красивый бейдж категории */}
                                            <div style={{ marginBottom: '4px' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#D97736', backgroundColor: '#FAF3E8', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {p.category || 'Без категории'}
                                                </span>
                                            </div>
                                            <div style={{ fontWeight: '900', color: '#5C3A21', fontSize: '15px' }}>
                                                {p.manufacturer} {p.series !== '—' ? p.series : ''}
                                            </div>
                                            <div style={{ marginTop: '3px', color: '#A0A0A0' }}>
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