import ExpressServer from '../../../expressServer';
import config from '../../../config';

const initServer = () => {
  let app;

  beforeEach(async () => {
    try {
      app = new ExpressServer(config.URL_PORT, config.OPENAPI_YAML);
      await app.launch();
      app.listen();
    } catch (error) {
      await app.close();
      throw error;
    }
  });

  afterEach(async () => {
    await app.close();
  });
};

export default { initServer };
