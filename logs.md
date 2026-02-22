root@msk-1-vm-l8ov:/var/www/jingai# pm2 logs jingai-backend --lines 0
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [requireAuth] Authenticated user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [my-psychologist] Request from user: client.vdovin.ser@demo.jung role: client
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [my-psychologist] Client found: {
0|jingai-backend  | 2026-02-22 10:57:23 +00:00:   id: 'cml58ssmr0007wwdwpkqpylfr',
0|jingai-backend  | 2026-02-22 10:57:23 +00:00:   psychologistId: 'cml58ssm80005wwdwxbgals9n'
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: }
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [GET /chat/rooms] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [my-psychologist] Returning psychologist: {
0|jingai-backend  | 2026-02-22 10:57:23 +00:00:   id: 'cml58ssm80005wwdwxbgals9n',
0|jingai-backend  | 2026-02-22 10:57:23 +00:00:   name: 'Вдовин Сергей Александрович'
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: }
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Returning 3 messages
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:57:23 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Returning 3 messages
0|jingai-backend  | 2026-02-22 10:57:24 +00:00: [GET /chat/rooms] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:57:24 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [requireAuth] Authenticated user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] ===== REQUEST START =====
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] User ID: cml58ssm80005wwdwxbgals9n
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] User Email: Vdovin.Ser@demo.jung
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] User Role: psychologist
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Authorization Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZC...
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Filtering for psychologist cml58ssm80005wwdwxbgals9n with whereClause: {"psychologistId":"cml58ssm80005wwdwxbgals9n"}
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /chat/rooms] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Found 2 clients from database
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Client psychologistIds: [
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   {
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     id: 'cml9ouwvw0049ww2dyp533t70',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     name: 'Александр',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     psychologistId: 'cml58ssm80005wwdwxbgals9n'
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   },
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   {
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     id: 'cml58ssmr0007wwdwpkqpylfr',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     name: 'Демо Клиент (Вдовин Сергей)',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     psychologistId: 'cml58ssm80005wwdwxbgals9n'
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   }
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: ]
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Returning 2 clients after security filter
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] After deduplication: 2 unique clients
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] ===== REQUEST END: Returning 2 items =====
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /chat/rooms] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [requireAuth] Authenticated user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] ===== REQUEST START =====
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] User ID: cml58ssm80005wwdwxbgals9n
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] User Email: Vdovin.Ser@demo.jung
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] User Role: psychologist
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Authorization Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZC...
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Filtering for psychologist cml58ssm80005wwdwxbgals9n with whereClause: {"psychologistId":"cml58ssm80005wwdwxbgals9n"}
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Found 2 clients from database
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Client psychologistIds: [
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   {
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     id: 'cml9ouwvw0049ww2dyp533t70',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     name: 'Александр',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     psychologistId: 'cml58ssm80005wwdwxbgals9n'
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   },
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   {
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     id: 'cml58ssmr0007wwdwpkqpylfr',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     name: 'Демо Клиент (Вдовин Сергей)',
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:     psychologistId: 'cml58ssm80005wwdwxbgals9n'
0|jingai-backend  | 2026-02-22 10:57:35 +00:00:   }
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: ]
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] Returning 2 clients after security filter
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] After deduplication: 2 unique clients
0|jingai-backend  | 2026-02-22 10:57:35 +00:00: [GET /clients] ===== REQUEST END: Returning 2 items =====
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms/cml9oz11x004kww2d25cakwzi/messages] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms/cml9oz11x004kww2d25cakwzi/messages] Returning 2 messages
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms/cml9oz11x004kww2d25cakwzi/messages] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:36 +00:00: [GET /chat/rooms/cml9oz11x004kww2d25cakwzi/messages] Returning 2 messages
0|jingai-backend  | 2026-02-22 10:57:37 +00:00: [GET /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:37 +00:00: [GET /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Returning 4 messages
0|jingai-backend  | 2026-02-22 10:57:37 +00:00: [GET /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:37 +00:00: [GET /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Returning 4 messages
0|jingai-backend  | 2026-02-22 10:57:42 +00:00: [POST /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Sending message from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist, content length: 6
0|jingai-backend  | 2026-02-22 10:57:42 +00:00: [POST /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Message created: cmlxmvw3a0000ww0g4tbie7pm
0|jingai-backend  | 2026-02-22 10:57:42 +00:00: [GET /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Request from user: cml58ssm80005wwdwxbgals9n (Vdovin.Ser@demo.jung), role: psychologist
0|jingai-backend  | 2026-02-22 10:57:42 +00:00: [GET /chat/rooms/cml59rhcz0006wwd5fqcr1cgz/messages] Returning 5 messages
0|jingai-backend  | 2026-02-22 10:58:00 +00:00: [requireAuth] Authenticated user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:00 +00:00: [my-psychologist] Request from user: client.vdovin.ser@demo.jung role: client
0|jingai-backend  | 2026-02-22 10:58:00 +00:00: [my-psychologist] Client found: {
0|jingai-backend  | 2026-02-22 10:58:00 +00:00:   id: 'cml58ssmr0007wwdwpkqpylfr',
0|jingai-backend  | 2026-02-22 10:58:00 +00:00:   psychologistId: 'cml58ssm80005wwdwxbgals9n'
0|jingai-backend  | 2026-02-22 10:58:00 +00:00: }
0|jingai-backend  | 2026-02-22 10:58:00 +00:00: [my-psychologist] Returning psychologist: {
0|jingai-backend  | 2026-02-22 10:58:00 +00:00:   id: 'cml58ssm80005wwdwxbgals9n',
0|jingai-backend  | 2026-02-22 10:58:00 +00:00:   name: 'Вдовин Сергей Александрович'
0|jingai-backend  | 2026-02-22 10:58:00 +00:00: }
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [requireAuth] Authenticated user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [my-psychologist] Request from user: client.vdovin.ser@demo.jung role: client
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [my-psychologist] Client found: {
0|jingai-backend  | 2026-02-22 10:58:02 +00:00:   id: 'cml58ssmr0007wwdwpkqpylfr',
0|jingai-backend  | 2026-02-22 10:58:02 +00:00:   psychologistId: 'cml58ssm80005wwdwxbgals9n'
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: }
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [my-psychologist] Returning psychologist: {
0|jingai-backend  | 2026-02-22 10:58:02 +00:00:   id: 'cml58ssm80005wwdwxbgals9n',
0|jingai-backend  | 2026-02-22 10:58:02 +00:00:   name: 'Вдовин Сергей Александрович'
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: }
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Returning 3 messages
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Returning 3 messages
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:02 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:58:08 +00:00: [GET /chat/rooms] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:08 +00:00: [GET /chat/rooms] Returning 24 rooms
0|jingai-backend  | 2026-02-22 10:58:08 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Request from user: cml58ssmg0006wwdwqy679nyu (client.vdovin.ser@demo.jung), role: client
0|jingai-backend  | 2026-02-22 10:58:08 +00:00: [GET /chat/rooms/cml6d31am000jww2dnkkybx2f/messages] Returning 3 messages
