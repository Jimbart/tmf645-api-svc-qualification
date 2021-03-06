import http from 'http';
import fs from 'fs';
import path from 'path';
import swaggerUI from 'swagger-ui-express';
import jsYaml from 'js-yaml';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import * as OpenApiValidator from 'express-openapi-validator';
import logger from './logger';
import config from './config';
import URL from './utils/enums/UrlEnum';
import * as dbServer from './dbServer';
import QueryServiceQualificationController from './controllers/QueryServiceQualificationController';
import CheckServiceQualificationController from './controllers/CheckServiceQualificationController';

const {
  createQueryServiceQualification,
  retrieveQueryServiceQualification,
} = QueryServiceQualificationController;
const {
  createCheckServiceQualification,
  retrieveCheckServiceQualification,
} = CheckServiceQualificationController;

class ExpressServer {
  constructor(port, openApiYaml) {
    this.port = port;
    this.app = express();
    this.openApiPath = openApiYaml;
    try {
      this.schema = jsYaml.safeLoad(fs.readFileSync(openApiYaml));
    } catch (e) {
      logger.error('failed to start Express Server', e.message);
    }
    this.setupMiddleware();
  }

  setupMiddleware() {
    // this.setupAllowedMedia();
    this.app.use(cors());
    this.app.use(bodyParser.json({ limit: '14MB' }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(cookieParser());

    // Post use case 1
    this.app.post(URL.POST_QUERY_SERVICE_QUAL, createQueryServiceQualification);

    // Get use case 1
    this.app.get(URL.GET_QUERY_SERVICE_QUAL, retrieveQueryServiceQualification);

    // Post use case 2
    this.app.post(URL.POST_CHECK_SERVICE_QUAL, createCheckServiceQualification);

    // Get use case 2
    this.app.get(URL.GET_CHECK_SERVICE_QUAL, retrieveCheckServiceQualification);

    // Simple test to see that the server is up and responding
    this.app.get('/hello', (req, res) => {
      res.send(`Hello World. path: ${this.openApiPath}`);
    });
    // Send the openapi document *AS GENERATED BY THE GENERATOR*
    this.app.get('/openapi', (req, res) =>
      res.sendFile(path.join(__dirname, 'api', 'openapi.yaml'))
    );
    // View the openapi document in a visual interface. Should be able to test from this page
    this.app.use('/api-doc', swaggerUI.serve, swaggerUI.setup(this.schema));
    this.app.get('/login-redirect', (req, res) => {
      res.status(200);
      res.json(req.query);
    });
    this.app.get('/oauth2-redirect.html', (req, res) => {
      res.status(200);
      res.json(req.query);
    });

    // Connection checker Firestore and Cloud SQL
    this.app.get('/firestore', (req, res) => {
      res.status(200);
      res.json({
        firestore: {
          connected: true,
          message: 'Connection OK',
        },
      });
    });

    this.app.get('/cloud-sql', async (req, res) => {
      const connection = await dbServer.getConnection();
      connection.query('SELECT NOW() AS now', (error, results) => {
        if (error) {
          res.status(500);
          res.json({ error });
        } else {
          res.status(200);
          res.json({ now: results[0].now });
        }
      });
    });

    // winston Logger
    this.app.use((req, res, next) => {
      logger.info(req.body);
      const oldSend = res.send;
      res.send = (data, ...args) => {
        logger.info(data);
        oldSend.apply(res, args);
      };
      next();
    });
  }

  launch() {
    this.app.use(
      OpenApiValidator.middleware({
        apiSpec: this.openApiPath,
        operationHandlers: path.join(__dirname),
        fileUploader: { dest: config.FILE_UPLOAD_PATH },
      })
    );
    // eslint-disable-next-line no-unused-vars
    this.app.use((err, req, res, next) => {
      // format errors
      res.status(err.status || 500).json({
        message: err.message || err,
        errors: err.errors || '',
      });
    });

    this.server = http.createServer(this.app);
  }

  listen() {
    this.server.listen(this.port);
    logger.info(`Listening on port ${this.port}`);
  }

  async close() {
    if (this.server !== undefined) {
      await this.server.close();
      logger.info(`Server on port ${this.port} shut down`);
    }
  }
}

export default ExpressServer;
