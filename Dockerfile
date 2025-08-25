# Use the Node.js v18.14.0 image as the base image
FROM node:18.14.0

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Command to start the app
CMD ["npm", "start"]
