import path from 'path';

const config = {
  ROOT_DIR: __dirname,
  URL_PORT: 8080,
  URL_PATH: 'http://localhost',
  PROJECT_DIR: __dirname,
};
config.OPENAPI_YAML = path.join(config.ROOT_DIR, '..', 'api', 'openapi.yaml');
config.FILE_UPLOAD_PATH = path.join(config.PROJECT_DIR, '..', 'uploaded_files');

export default config;
