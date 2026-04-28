import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Системные переменные (доступны в Supabase автоматически)
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
// Наш секретный ключ, который мы задали через secrets set SB_SERVICE_ROLE_KEY
const serviceRoleKey = Deno.env.get('SB_SERVICE_ROLE_KEY') ?? ''; 
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    // Работаем только с таблицей заказов
    if (table !== 'orders') return new Response('Not orders table');

    const chatId = record.user_id;
    const orderId = record.id.substring(0, 6).toUpperCase();

    // 1. Получаем актуальные названия статусов из БД, чтобы не хардкодить их
    const { data: statuses } = await supabase
      .from('order_statuses')
      .select('id, label');
    
    const statusMap = Object.fromEntries(statuses?.map(s => [s.id, s.label]) || []);

    let message = "";

    // --- СЦЕНАРИЙ А: НОВЫЙ ЗАКАЗ (INSERT) ---
    if (type === 'INSERT') {
      let itemsList = "";
      const items = record.items;

      // Группируем товары для красивого чека: Категория -> Линейка
      const grouped: any = {};
      for (const key in items) {
        const item = items[key];
        const p = item.product;
        const cat = p.category || "Прочее";
        
        // Определяем имя линейки/серии
        let series = (p.series && p.series !== "—") ? p.series : p.manufacturer;
        series = series.replace(/new\s+/i, '').trim();
        
        if (!grouped[cat]) grouped[cat] = {};
        if (!grouped[cat][series]) grouped[cat][series] = [];
        grouped[cat][series].push(item);
      }

      // Формируем текстовый список позиций
      for (const cat in grouped) {
        itemsList += `\n<b>🔹 ${cat.toUpperCase()}</b>\n`;
        for (const series in grouped[cat]) {
          itemsList += `  • <b>${series}:</b>\n`;
          grouped[cat][series].forEach((i: any) => {
            itemsList += `    — ${i.product.flavor} (${i.qty} шт.)\n`;
          });
        }
      }

      message = `🛍 <b>Ваш заказ #${orderId} оформлен!</b>\n` +
                itemsList +
                `\n💰 <b>Итого к оплате: ${record.total_price} р.</b>\n` +
                `📍 Способ: ${record.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'}\n\n` +
                `⏳ Ожидайте, менеджер уже приступил к обработке!`;
    } 

    // --- СЦЕНАРИЙ Б: ИЗМЕНЕНИЕ СТАТУСА (UPDATE) ---
    else if (type === 'UPDATE') {
      // Если статус не менялся (например, обновили адрес), ничего не шлем
      if (!old_record || old_record.status_id === record.status_id) {
        return new Response('No status change');
      }

      const statusName = statusMap[record.status_id] || `Статус #${record.status_id}`;
      message = `🔔 <b>Заказ #${orderId} обновлен</b>\n\n` +
                `Новый статус: <b>${statusName}</b>`;
    }

    // Отправка в Telegram
    if (message && TELEGRAM_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error('Error in Notify Function:', err);
    return new Response(String(err), { status: 500 });
  }
})
