import axios from 'axios';
import endToEndSetup from './tests/end2end/setup/endToEnd.setup';
import config from './config';

endToEndSetup.initServer();

test('launches successfully', async () => {
  const response = await axios.get(
    `${config.URL_PATH}:${config.URL_PORT}/hello`
  );
  expect(response.status).toBe(200);
});

test('fails with a 404 on non-existing page', async () => {
  await expect(
    axios.get(`${config.URL_PATH}:${config.URL_PORT}/someRandomPage`)
  ).rejects.toThrow('Request failed with status code 404');
});

test('loads API documentation', async () => {
  const response = await axios.get(
    `${config.URL_PATH}:${config.URL_PORT}/api-doc`
  );
  expect(response.status).toBe(200);
});
