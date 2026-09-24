# Base Image Node.js LTS
FROM node:20-alpine

# Set Working Directory
WORKDIR /app

# Copy dependency definition
COPY package*.json ./

# Install Dependencies
RUN npm install --production

# Copy source code
COPY . .

# Expose Port
EXPOSE 5000

# Run Application
CMD ["npm", "start"]