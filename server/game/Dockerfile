FROM node:22-alpine

WORKDIR /app 

COPY ./pack*.json ./ 

RUN npm install 

COPY . . 

RUN npm run build 

CMD ["npm", "start"]
