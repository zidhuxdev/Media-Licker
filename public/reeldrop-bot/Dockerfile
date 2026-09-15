FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m pip install -U --no-cache-dir --break-system-packages yt-dlp bgutil-ytdlp-pot-provider


WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
USER node

CMD ["node", "src/index.js"]
