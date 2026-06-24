# 키위보카 프론트 — 로컬 개발 (Vite dev 서버, HMR)
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
