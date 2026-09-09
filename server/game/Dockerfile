FROM node:22-alpine

WORKDIR /app 

COPY ./pack*.json ./ 

RUN npm install 

COPY . . 

ENTRYPOINT ["npm","run","dev"]
