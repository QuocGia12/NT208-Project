FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache nginx

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh \
  && chmod 644 /etc/nginx/http.d/default.conf

ENV NODE_ENV=production
EXPOSE 80
CMD ["/usr/local/bin/docker-entrypoint.sh"]