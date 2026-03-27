FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build
COPY . .
RUN npx tsc

# Install only Chromium
RUN npx playwright install chromium

CMD ["node", "dist/index.js"]
