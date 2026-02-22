# 7. Проверить доступность
curl -I http://212.193.30.213
curl http://212.193.30.213/api/health
/etc/nginx/sites-available/jingai:    server_name 212.193.30.213;
/etc/nginx/sites-available/jung-ai:    server_name jung-ai.ru www.jung-ai.ru 212.193.30.213;
total 8
drwxr-xr-x 2 root root 4096 Feb 22 09:52 .
drwxr-xr-x 8 root root 4096 Feb 13 06:42 ..
lrwxrwxrwx 1 root root   33 Feb  2 11:42 jingai -> /etc/nginx/sites-available/jingai
lrwxrwxrwx 1 root root   34 Feb 22 09:52 jung-ai -> /etc/nginx/sites-available/jung-ai
    server_name 212.193.30.213;

    # Редирект на HTTPS (раскомментируйте после настройки SSL)
    # return 301 https://$server_name$request_uri;

    # Лимиты для загрузки файлов
    client_max_body_size 50M;

    # Frontend (статичные файлы)
--
#     server_name yourdomain.com www.yourdomain.com;
#
#     ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
--
    server_name jung-ai.ru www.jung-ai.ru 212.193.30.213;

    # Редирект на HTTPS (после настройки SSL)
    # Раскомментируйте после получения SSL сертификата
    # return 301 https://$server_name$request_uri;

    # Временная конфигурация для HTTP (до настройки SSL)
    root /var/www/jingai/frontend/dist;
    index index.html;

--
#     server_name jung-ai.ru www.jung-ai.ru;
#
#     ssl_certificate /etc/letsencrypt/live/jung-ai.ru/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/jung-ai.ru/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
2026/02/22 11:08:07 [warn] 470867#470867: conflicting server name "212.193.30.213" on 0.0.0.0:80, ignored
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Date: Sun, 22 Feb 2026 11:08:07 GMT
Content-Type: text/html
Content-Length: 538
Last-Modified: Sun, 22 Feb 2026 11:03:48 GMT
Connection: keep-alive
ETag: "699ae294-21a"
Accept-Ranges: bytes

{"status":"ok"}root@msk-1-vm-l8ov:/vsudo rm /etc/nginx/sites-enabled/jingai-enabled/jingai
root@msk-1-vm-l8ov:/var/www/jingai# sudo nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
root@msk-1-vm-l8ov:/var/www/jingai# sudo systemctl reload nginx
root@msk-1-vm-l8ov:/var/www/jingai# sudo nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
root@msk-1-vm-l8ov:/var/www/jingai# curl -I http://212.193.30.213
HTTP/1.1 200 OK
Server: nginx/1.24.0 (Ubuntu)
Date: Sun, 22 Feb 2026 11:09:22 GMT
Content-Type: text/html
Content-Length: 538
Last-Modified: Sun, 22 Feb 2026 11:03:48 GMT
Connection: keep-alive
ETag: "699ae294-21a"
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
Accept-Ranges: bytes

root@msk-1-vm-l8ov:/var/www/jingai# curl http://212.193.30.213/api/health
root@msk-1-vm-l8ov:/var/www/jingai# dig @8.8.8.8 jung-ai.ru A.8 jung-ai.ru A
dig @1.1.1.1 jung-ai.ru A

; <<>> DiG 9.18.39-0ubuntu0.24.04.2-Ubuntu <<>> @8.8.8.8 jung-ai.ru A
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 29098
;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 512
;; QUESTION SECTION:
;jung-ai.ru.                    IN      A

;; AUTHORITY SECTION:
ru.                     1800    IN      SOA     a.dns.ripn.net. hostmaster.ripn.net. 4067897 86400 14400 2592000 3600

;; Query time: 77 msec
;; SERVER: 8.8.8.8#53(8.8.8.8) (UDP)
;; WHEN: Sun Feb 22 11:09:50 UTC 2026
;; MSG SIZE  rcvd: 100


; <<>> DiG 9.18.39-0ubuntu0.24.04.2-Ubuntu <<>> @1.1.1.1 jung-ai.ru A
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 14907
;; flags: qr rd ra; QUERY: 1, ANSWER: 0, AUTHORITY: 1, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;jung-ai.ru.                    IN      A

;; AUTHORITY SECTION:
ru.                     3600    IN      SOA     a.dns.ripn.net. hostmaster.ripn.net. 4067897 86400 14400 2592000 3600

;; Query time: 17 msec
;; SERVER: 1.1.1.1#53(1.1.1.1) (UDP)
;; WHEN: Sun Feb 22 11:09:50 UTC 2026
;; MSG SIZE  rcvd: 100

root@msk-1-vm-l8ov:/var/www/jingai#