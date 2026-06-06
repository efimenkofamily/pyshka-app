import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
// ❗️ ИСПРАВЛЕНО: Правильное имя ключа администратора для обхода RLS
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''; 
const supabase = createClient(supabaseUrl, serviceRoleKey);

const CATEGORY_MAP: Record<number, string> = {
    1: 'Жидкости', 4: 'Поды', 5: 'Одноразки', 7: 'Никотиновые пластинки',
    8: 'Снюс', 10: 'Расходники', 11: 'Уголь для кальяна', 14: 'АКБ'
};

const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://smoketeamby.com/store/vape",
    "Origin": "https://smoketeamby.com",
    "Connection": "keep-alive"
};

serve(async (req) => {
    try {
        console.log("🚀 Запуск синхронизации (ОЧЕРЕДЬ + АНТИ-429 + RLS BYPASS)...");
        
        // --- ЭТАП 1: Получаем каталог ---
        const catalogResponse = await fetch(`https://smoketeamby.com/api/v1/store/vape/catalog?page=1&per_page=100`, {
            headers: BROWSER_HEADERS
        });

        if (!catalogResponse.ok) throw new Error(`Ошибка каталога: ${catalogResponse.status}`);
        
        const catalogJson = await catalogResponse.json();
        const allGroups = catalogJson.groups || [];

        if (allGroups.length === 0) throw new Error("Пустой каталог");
        console.log(`✅ Всего собрано ${allGroups.length} линеек. Начинаем обход по одной...`);
        
        let newProducts: any[] = [];
        
        // --- ЭТАП 2: Умный обход с обработкой 429 ---
        for (let i = 0; i < allGroups.length; i++) {
            const group = allGroups[i];
            let retryCount = 0;
            let success = false;

            // Если поймали 429, пытаемся до 3-х раз
            while (!success && retryCount < 3) {
                try {
                    const detailResponse = await fetch(`https://smoketeamby.com/api/v1/store/vape/groups/${group.id}`, {
                        headers: BROWSER_HEADERS
                    });
                    
                    // Если словили лимит запросов (429)
                    if (detailResponse.status === 429) {
                        console.warn(`⚠️ 429 Too Many Requests (ID ${group.id}). Остываем 2 секунды...`);
                        await new Promise(r => setTimeout(r, 2000));
                        retryCount++;
                        continue; // Пробуем эту же карточку заново
                    }

                    if (!detailResponse.ok) {
                        console.warn(`⚠️ Ошибка ID ${group.id}: статус ${detailResponse.status}`);
                        break; // Выходим из цикла while, идем к следующему товару
                    }

                    const detailJson = await detailResponse.json();
                    const categoryName = CATEGORY_MAP[detailJson.category_id] || 'Другое';

                    const findTierPrice = (tiers: any[], targetQty: number) => {
                        if (!tiers || !Array.isArray(tiers)) return null;
                        const tier = tiers.find(t => Number(t.min_qty) === targetQty);
                        return tier ? Number(tier.price) : null;
                    };

                    const processVariant = (v: any) => {
                        const stock = Math.round(Number(v.stock_qty || 0));
                        const basePrice = Number(v.retail_price || detailJson.price_min || 0);
                        const price10 = findTierPrice(v.tier_prices, 10) || basePrice;
                        const price20 = findTierPrice(v.tier_prices, 20) || price10;

                        newProducts.push({
                            category: categoryName,
                            manufacturer: detailJson.brand || '—',
                            series: detailJson.name,
                            flavor: v.attributes?.flavor || '—',
                            strength: v.attributes?.nicotine_mg ? `${v.attributes.nicotine_mg}mg` : '—',
                            availability: stock > 0 ? 'есть' : 'нет',
                            stock_qty: stock,
                            price_10: price10,
                            price_20: price20,
                            price_100: price20, 
                            options: '—',
                            is_new: false
                        });
                    };

                    if (detailJson.variants && detailJson.variants.length > 0) {
                        detailJson.variants.forEach(processVariant);
                    } else {
                        processVariant(detailJson);
                    }
                    
                    success = true; // Успешно обработали!

                } catch (err) {
                    console.error(`❌ Ошибка сети на ID ${group.id}:`, err);
                    await new Promise(r => setTimeout(r, 1000));
                    retryCount++;
                }
            }

            // Стандартная пауза между карточками, чтобы не провоцировать 429
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        console.log(`📦 Сбор завершен. Собрано ${newProducts.length} позиций. Заливаем в БД...`);

        // --- ЭТАП 3: Заливка в Supabase (теперь сработает 100%) ---
        const { error: deleteError } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) throw new Error(`Ошибка очистки таблицы: ${deleteError.message}`);

        const insertChunkSize = 500;
        for (let i = 0; i < newProducts.length; i += insertChunkSize) {
            const chunk = newProducts.slice(i, i + insertChunkSize);
            const { error: insertError } = await supabase.from('products').insert(chunk);
            if (insertError) throw new Error(`Ошибка вставки данных: ${insertError.message}`);
        }

        console.log("🎉 База данных products успешно обновлена!");
        return new Response(JSON.stringify({ success: true, total_products: newProducts.length }), { headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Критическая ошибка:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});