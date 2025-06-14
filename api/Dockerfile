# 1. Use a lean Node.js runtime as a parent image
FROM node:20-slim

# 2. Set the working directory in the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json
COPY package*.json ./

# 4. Install production dependencies
# Using `npm ci` is often better for CI environments
RUN npm ci --only=production

# 5. Copy the rest of the application code
COPY . .

# 6. Compile TypeScript to JavaScript
RUN npm run compile

# 7. Expose the port the app runs on (optional but good practice)
EXPOSE 8080

# 8. Define the command to run the function
CMD [ "npm", "start" ]
