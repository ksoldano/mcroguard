FROM node:20
#FROM j33f/node-docker-container

ENV PORT=10091

RUN mkdir -p /usr/app/vms/ssr-api-server
RUN chmod -R 777 /usr/app/vms/ssr-api-server


#RUN yarn install

WORKDIR /usr/app/vms/ssr-api-server
#COPY package.json ./

ENV NODE_ENV production

#RUN npm install
#RUN npm install -g npm@9.2.0
#-g --unsafe-perm=true --allow-root

COPY ./index.js .
EXPOSE $PORT

CMD["yarn","serve"]
#ENTRYPOINT ["node", "server.js"]
