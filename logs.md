root@msk-1-vm-l8ov:/var/www/jingai# # 1. Проверить, запущен ли backendущен ли backend
pm2 status

# 2. Проверить, слушает ли backend на порту 4000
sudo ss -tlnp | grep :4000
# ИЛИ
sudo netstat -tlnp | grep :4000

# 3. Проверить логи backend
pm2 logs jingai-backend --lines 30

# 4. Проверить логи Nginx (ошибки)
sudo tail -50 /var/log/nginx/jung-ai-error.log

# 5. Проверить, отвечает ли backend локально
curl http://localhost:4000/api/health

# 6. Проверить, отвечает ли backend по IP
curl http://212.193.30.213/api/health

# 7. Если backend не запущен, запустить его
cd /var/www/jingai
pm2 restart jingai-backend
# ИЛИ если его нет в pm2:
pm2 start ecosystem.config.js
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ jingai-backend     │ fork     │ 56   │ online    │ 0%       │ 75.4mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
LISTEN 0      511                *:4000             *:*    users:(("node /var/www/j",pid=471385,fd=21))                 
sudo: netstat: command not found
[TAILING] Tailing last 30 lines for [jingai-backend] process (change the value with --lines option)
/var/www/jingai/logs/backend-error.log last 30 lines:
0|jingai-b | 2026-02-22 10:33:10 +00:00:       },
0|jingai-b | 2026-02-22 10:33:10 +00:00:       {
0|jingai-b | 2026-02-22 10:33:10 +00:00:         psychologistId: {
0|jingai-b | 2026-02-22 10:33:10 +00:00:           not: {
0|jingai-b | 2026-02-22 10:33:10 +00:00:             startsWith: "temp-"
0|jingai-b | 2026-02-22 10:33:10 +00:00:           }
0|jingai-b | 2026-02-22 10:33:10 +00:00:         }
0|jingai-b | 2026-02-22 10:33:10 +00:00:       }
0|jingai-b | 2026-02-22 10:33:10 +00:00:     ]
0|jingai-b | 2026-02-22 10:33:10 +00:00:   },
0|jingai-b | 2026-02-22 10:33:10 +00:00:   select: {
0|jingai-b | 2026-02-22 10:33:10 +00:00:     id: true,
0|jingai-b | 2026-02-22 10:33:10 +00:00:     name: true,
0|jingai-b | 2026-02-22 10:33:10 +00:00:     email: true,
0|jingai-b | 2026-02-22 10:33:10 +00:00:     phone: true,
0|jingai-b | 2026-02-22 10:33:10 +00:00:     psychologistId: true,
0|jingai-b | 2026-02-22 10:33:10 +00:00:     createdAt: true
0|jingai-b | 2026-02-22 10:33:10 +00:00:   },
0|jingai-b | 2026-02-22 10:33:10 +00:00:   orderBy: {
0|jingai-b | 2026-02-22 10:33:10 +00:00:     createdAt: "desc"
0|jingai-b | 2026-02-22 10:33:10 +00:00:   }
0|jingai-b | 2026-02-22 10:33:10 +00:00: }
0|jingai-b | 2026-02-22 10:33:10 +00:00:
0|jingai-b | 2026-02-22 10:33:10 +00:00: Argument `not` is missing.
0|jingai-b | 2026-02-22 10:33:10 +00:00:     at Nn (/var/www/jingai/node_modules/@prisma/client/runtime/library.js:29:1363)
0|jingai-b | 2026-02-22 10:33:10 +00:00:     at ei.handleRequestError (/var/www/jingai/node_modules/@prisma/client/runtime/library.js:121:6911)
0|jingai-b | 2026-02-22 10:33:10 +00:00:     at ei.handleAndLogRequestError (/var/www/jingai/node_modules/@prisma/client/runtime/library.js:121:6593)
0|jingai-b | 2026-02-22 10:33:10 +00:00:     at ei.request (/var/www/jingai/node_modules/@prisma/client/runtime/library.js:121:6300)
0|jingai-b | 2026-02-22 10:33:10 +00:00:     at async a (/var/www/jingai/node_modules/@prisma/client/runtime/library.js:130:9551)
0|jingai-b | 2026-02-22 10:33:10 +00:00:     at async /var/www/jingai/backend/dist/routes/clients.js:392:25
