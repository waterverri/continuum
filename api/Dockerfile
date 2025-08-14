# ---- Stage 1: Build ----
# This stage installs all dependencies, including dev dependencies,
# and builds the TypeScript code into JavaScript.
FROM node:20 as builder
WORKDIR /usr/src/app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Compile TypeScript to JavaScript using an explicit path and project flag
RUN node_modules/.bin/tsc -p tsconfig.json


# ---- Stage 2: Production ----
# This stage starts fresh with a lean image and copies only
# the necessary production files from the 'builder' stage.
FROM node:20-slim
WORKDIR /usr/src/app

# Install dependencies required for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the compiled JavaScript code from the 'builder' stage
COPY --from=builder /usr/src/app/build ./build

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run the app
CMD [ "npm", "start" ]
