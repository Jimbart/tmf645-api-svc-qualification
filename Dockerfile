# Use the official lightweight Node.js 14 image
# https://hub.docker.com/_/node
FROM node:14-slim

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . ./
ENV DEBUG=CheckServiceQualificationService,CheckServiceQualificationController,FirestoreRepository,DatabaseRepository,EmailSender,CsqExpiredItemsProcessor,CsqNoFootprintProcessor,CsqAbstractService,VideotronApi,QueryServiceQualificationService,QueryServiceQualificationController,VideotronApi,AmsApi

# Run the web service on container startup.
EXPOSE 8080
CMD [ "npm", "start" ]
