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

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the compiled JavaScript code from the 'builder' stage
COPY --from=builder /usr/src/app/build ./build

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run the app
CMD [ "npm", "start" ]
