import config from './config';
import logger from './logger';
import ExpressServer from './expressServer';
import * as dbServer from './dbServer';

const launchServer = async () => {
  let expressServer;
  try {
    logger.info(`Current environment: "${process.env.NODE_ENV}"`);
    expressServer = new ExpressServer(config.URL_PORT, config.OPENAPI_YAML);
    expressServer.launch();
    expressServer.listen();
    logger.info('Express server running');

    const testConnection = await dbServer.getConnection();
    logger.info(`DB connection state is ${testConnection.state}`);
    dbServer.close(testConnection);
  } catch (error) {
    logger.error('Express Server failure', error.message);
    await expressServer.close();
  }
};

launchServer().catch((e) => logger.error(e));
