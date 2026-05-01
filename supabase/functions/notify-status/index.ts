import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SB_SERVICE_ROLE_KEY') ?? ''; 
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    // ==========================================
    // ЛОГИКА ДЛЯ ПОЛЬЗОВАТЕЛЕЙ (РЕГИСТРАЦИЯ)
    // ==========================================
    if (table === 'users' && type === 'INSERT') {
        const newUser = record;
        
        // Отправляем пуш только если статус 'pending' (ждет апрува)
        if (newUser.status === 'pending') {
            // Ищем всех админов в базе
            const { data: admins } = await supabase
                .from('users')
                .select('id')
                .eq('status', 'admin');

            if (admins && admins.length > 0) {
                const message = `👋 <b>Стучится новый пользователь!</b>\n\n` +
                                `👤 Имя: <b>${newUser.full_name}</b>\n` +
                                `🔗 Юзернейм: @${newUser.username}\n` +
                                `📢 Откуда узнал: <i>${newUser.source}</i>\n\n` +
                                `Зайди в Админку ➔ вкладка «Пользователи», чтобы проверить и принять заявку.`;

                // Делаем рассылку всем админам
                for (const admin of admins) {
                    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: admin.id,
                            text: message,
                            parse_mode: 'HTML'
                        })
                    });
                }
            }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // ==========================================
    // ЛОГИКА ДЛЯ ЗАКАЗОВ (ПРЕДЫДУЩИЙ КОД)
    // ==========================================
    if (table === 'orders') {
        const chatId = record.user_id;
        const orderId = record.id.substring(0, 6).toUpperCase();

        const { data: statuses } = await supabase.from('order_statuses').select('id, label');
        const statusMap = Object.fromEntries(statuses?.map(s => [s.id, s.label]) || []);

        let message = "";

        if (type === 'INSERT') {
          let itemsList = "";
          const items = record.items;

          const grouped: any = {};
          for (const key in items) {
            const item = items[key];
            const p = item.product;
            const cat = p.category || "Прочее";
            
            let series = (p.series && p.series !== "—") ? p.series : p.manufacturer;
            series = series.replace(/new\s+/i, '').trim();
            
            if (!grouped[cat]) grouped[cat] = {};
            if (!grouped[cat][series]) grouped[cat][series] = [];
            grouped[cat][series].push(item);
          }

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
        else if (type === 'UPDATE') {
          if (!old_record || old_record.status_id === record.status_id) {
            return new Response('No status change');
          }
          const statusName = statusMap[record.status_id] || `Статус #${record.status_id}`;
          message = `🔔 <b>Заказ #${orderId} обновлен</b>\n\nНовый статус: <b>${statusName}</b>`;
        }

        if (message && TELEGRAM_BOT_TOKEN) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
          });
        }
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Если таблица не относится ни к заказам, ни к юзерам
    return new Response('Ignored table');

  } catch (err) {
    console.error('Error in Notify Function:', err);
    return new Response(String(err), { status: 500 });
  }
})
