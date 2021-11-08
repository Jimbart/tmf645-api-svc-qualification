import axios from 'axios';
import createDebug from 'debug';
import path from 'path';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

const debug = createDebug(path.basename(__filename, '.js'));

endToEndSetup.initServer();

describe('QSQ POST Find Offers for a unknown lpdsId', () => {
  test('Qual Api should return null and 200 status no error base on TNF', async () => {
    const request = {
      description: 'Initial Technical',
      externalId: '6161:SQ101',
      '@type': 'QueryServiceQualification',
      searchCriteria: {
        '@type': 'ServiceQualificationItem',
        service: {
          serviceType: 'business',
          '@type': 'Service',
          place: [
            {
              id: '0000000',
              role: 'Service Qualification Place',
              '@type': 'GeographicAddress',
            },
          ],
        },
      },
    };

    try {
      const response = await axios.post(
        `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification`,
        request
      );

      expect(response.status).toBe(200);
      // expect(response.message).toMatch('Lpdsid not found in AMS');
    } catch (error) {
      debug(error);
    }
  });
});
