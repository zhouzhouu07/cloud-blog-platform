FROM node:lts-alpine3.24 AS builder

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

ENV VITE_API_BASE=""

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
