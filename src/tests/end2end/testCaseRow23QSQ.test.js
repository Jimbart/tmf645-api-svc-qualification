/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

const request = {
    description: 'Initial Technical 111111',
    externalId: '6161:SQ101',
    '@type': 'QueryServiceQualification',
    searchCriteria: {
      '@type': 'ServiceQualificationItem',
      service: {
        serviceType: 'business',
        '@type': 'Service',
        place: [
          {
            id: '000011',
            role: 'Service Qualification Place',
            '@type': 'GeographicAddress',
          },
        ],
      },
    },
  };

// 000011  invalid LPDS ID
describe('QSQ Error response API to a invalid LpdsId', () => {
  test('QSQ will be terminate with error', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification`,
      request
    );

    expect(response.status).toBe(200);

    // validate response header
    expect(response.data).toEqual(
      expect.objectContaining({
        state: 'done',
        externalId: '6161:SQ101',
      })
    );

    // validate response serviceQualificationItem ia null
    expect(JSON.stringify(response.data.serviceQualificationItem)).toBe('[]')
    
  
  });
});
