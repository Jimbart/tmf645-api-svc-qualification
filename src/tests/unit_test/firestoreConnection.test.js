import axios from 'axios';
import endToEndSetup from '../end2end/setup/endToEnd.setup';
import config from '../../config';

endToEndSetup.initServer();

test('launches successfully', async () => {
  const response = await axios.get(
    `${config.URL_PATH}:${config.URL_PORT}/firestore`
  );

  const { connected, message } = response.data.firestore;
  expect(response.status).toBe(200);
  expect(connected).toBe(true);
  expect(message).toMatch('Connection OK');
  expect(message).not.toBe('No Connection');
});
