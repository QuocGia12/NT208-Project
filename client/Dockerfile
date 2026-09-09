FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache nginx 

COPY ./pack*.json ./

RUN npm install

COPY . .

RUN npm run build 

COPY nginx.conf /etc/nginx/http.d/default.conf

RUN chmod 644 /etc/nginx/http.d/default.conf 

EXPOSE 80

CMD ["sh", "-c", "npm start & nginx -g 'daemon off;'"]
