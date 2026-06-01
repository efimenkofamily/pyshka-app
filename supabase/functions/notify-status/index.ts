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

    // 🚀 1. СКАЧИВАЕМ МАТРИЦУ УВЕДОМЛЕНИЙ
    const { data: configData } = await supabase.from('config').select('notification_matrix').eq('id', 1).single();
    const matrix = configData?.notification_matrix || {};

    // 🛑 2. УМНЫЙ ВАХТЕР (Проверка разрешений матрицы)
    const canSend = (eventName: string, role: string) => {
        if (!matrix[eventName]) return true; // Если правила нет, по умолчанию отправляем
        return matrix[eventName][role] === true;
    };

    // ==========================================
    // ЛОГИКА ДЛЯ ПОЛЬЗОВАТЕЛЕЙ (Заявки)
    // ==========================================
    if (table === 'users') {
        if (type === 'INSERT' && record.status === 'pending') {
            const { data: staff } = await supabase.from('users').select('id, status').in('status', ['admin', 'developer']);

            if (staff && staff.length > 0) {
                const message = `👋 <b>Стучится новый...</b>\n\n` +
                                `👤 Имя: <b>${record.full_name}</b>\n` +
                                `🔗 Юзернейм: @${record.username}\n` +
                                `📢 Откуда узнал: <i>${record.source}</i>\n\n` +
                                `Зайдите в админку, чтобы одобрить.`;

                for (const person of staff) {
                    if (canSend('NEW_USER_PENDING', person.status)) {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: person.id, text: message, parse_mode: 'HTML' })
                        });
                    }
                }
            }
        }
    }

    // ==========================================
    // ЛОГИКА ДЛЯ ЗАКАЗОВ
    // ==========================================
    if (table === 'orders') {
        const chatId = record.user_id;
        const orderId = record.id.substring(0, 6).toUpperCase();
        let message = '';
        let eventName = '';

        const { data: buyer } = await supabase.from('users').select('status').eq('id', chatId).single();
        const buyerRole = buyer?.status || 'approved';

        if (type === 'INSERT') {
            eventName = 'NEW_ORDER';
            let itemsList = '';
            if (record.items) {
              for (const [id, i] of Object.entries(record.items as Record<string, any>)) {
                const title = i.product?.series && i.product?.series !== '—' ? i.product.series : (i.product?.manufacturer || 'Товар');
                const flavor = i.product?.flavor || '';
                itemsList += `    — <b>${title}</b> ${flavor} (${i.qty} шт.)\n`;
              }
            }

            message = `🛍 <b>Ваш заказ #${orderId} оформлен!</b>\n` +
                      itemsList +
                      `\n💰 <b>Итого к оплате: ${record.total_price} р.</b>\n` +
                      `📍 Способ: ${record.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'}\n\n` +
                      `⏳ Ожидайте, менеджер уже приступил к обработке!`;

            // Уведомление администрации о новом заказе
            const { data: staffMembers } = await supabase.from('users').select('id, status').in('status', ['admin', 'developer']);
            if (staffMembers && staffMembers.length > 0) {
                const staffMessage = `🔥 <b>Поступил новый заказ #${orderId}!</b>\n\n` +
                                     `👤 Покупатель: <b>${record.user_name || 'id ' + record.user_id}</b>\n` +
                                     `📍 Способ: <b>${record.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'}</b>\n` +
                                     `🏠 Адрес/Коммент: <i>${record.address || '—'}</i>\n\n` +
                                     `📦 <b>Состав заказа:</b>\n` + itemsList +
                                     `\n💰 <b>Сумма чека: ${record.total_price} ₽</b>\n\n` +
                                     `Зайдите в админку, чтобы взять в работу.`;

                for (const person of staffMembers) {
                    if (canSend('NEW_ORDER_STAFF', person.status)) {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: person.id, text: staffMessage, parse_mode: 'HTML' })
                        });
                    }
                }
            }
        } 
        else if (type === 'UPDATE') {
            eventName = 'ORDER_STATUS_CHANGED';
            if (!old_record || old_record.status_id === record.status_id) {
              return new Response('No status change');
            }
            
            const { data: statusObj } = await supabase.from('order_statuses').select('label').eq('id', record.status_id).single();
            const statusName = statusObj?.label || `Статус #${record.status_id}`;
            
            message = `🔔 <b>Заказ #${orderId} обновлен</b>\n\nНовый статус: <b>${statusName}</b>`;
        }

        if (message && TELEGRAM_BOT_TOKEN && eventName) {
            if (canSend(eventName, buyerRole)) {
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
                });
            }
        }
    }

    // ==========================================
    // ЛОГИКА ДЛЯ МАГАЗИНА (Открытие / Закрытие дропа)
    // ==========================================
    if (table === 'config' && type === 'UPDATE') {
        let broadcastMessage = '';
        let eventName = '';

        // 💡 Теперь мы смотрим на системную колонку store_status, 
        // которую меняет наш минутный таймер (Cron), а не админ ручками.
        if (record.store_status === 'open' && old_record?.store_status !== 'open') {
            eventName = 'STORE_OPENED';
            broadcastMessage = `🟢 <b>Магазин открыт!</b>\n\nКаталог разблокирован, мы готовы принимать ваши заказы. Залетайте за покупками!`;
        }
        else if (record.store_status === 'closed' && old_record?.store_status !== 'closed') {
            eventName = 'STORE_CLOSED';
            broadcastMessage = `🔴 <b>Магазин закрыт!</b>\n\nПрием заказов окончен. Спасибо всем, кто успел! Ждем вас в следующем дропе.`;
        }

        if (broadcastMessage && eventName) {
            const { data: allUsers } = await supabase.from('users').select('id, status');
            if (allUsers) {
                for (const user of allUsers) {
                    if (canSend(eventName, user.status)) {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: user.id, text: broadcastMessage, parse_mode: 'HTML' })
                        });
                        await new Promise(res => setTimeout(res, 50)); // Защита от спам-лимитов TG
                    }
                }
            }
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Критическая ошибка:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});