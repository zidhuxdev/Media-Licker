FROM aiogram/telegram-bot-api:latest

ENV TELEGRAM_LOCAL=1
ENV TELEGRAM_STAT=1
ENV TELEGRAM_PORT=8081

EXPOSE 8081

CMD ["--local", "--stat", "--http-port", "8081", "--dir", "/var/lib/telegram-bot-api", "--temp-dir", "/tmp"]
