import 'dotenv/config';
import createDebug from 'debug';
import path from 'path';
import mysql from 'mysql';
import logger from './logger';

const debug = createDebug(path.basename(__filename, '.js'));

const createConnection = () => {
  const dbServer = mysql.createConnection({
    database: process.env.OFFNET_MYSQL_SCHEMA,
    user: process.env.OFFNET_MYSQL_USER,
    password: process.env.OFFNET_MYSQL_PASS,
  });

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line consistent-return
    dbServer.connect((error) => {
      if (error) {
        logger.error(`DB connection failed: ${error.message}`);
        return reject(error);
      }
      resolve(dbServer);
    });
  });
};

let connection;
const getConnection = async () => {
  if (!connection || !connection === false) {
    connection = await createConnection();
    debug('getConnection is ', connection.state);
  }
  return connection;
};

const close = async (currentConnection) => {
  debug('Closing DB connection', currentConnection.state);
  if (currentConnection) {
    try {
      await currentConnection.end();
      debug('DB connection closed!');
    } catch (error) {
      debug('ERROR closing DB connection:', error.message);
    }
  }
};

// eslint-disable-next-line import/prefer-default-export
export { getConnection, close };
