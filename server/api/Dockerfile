FROM node:22-alpine

WORKDIR /app 

RUN apk add --no-cache openssl libc6-compat

COPY ./pack*.json ./ 

RUN npm install 

COPY . . 

ENTRYPOINT ["sh", "-c", "npm run prisma:migrate && npm run prisma:seed && npm run dev"]
