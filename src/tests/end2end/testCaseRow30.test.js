/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

const request = {
  description: 'Initial Technical Eligibility',
  externalId: '6161:SQ101',
  instantSyncQualification: 'true',
  serviceQualificationItem: [
    {
      id: '1',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '2377068',
            role: 'Service Qualification Place',
            '@type': 'GeographicAddress',
          },
        ],
        serviceSpecification: {
          id: '1',
          href:
            'http://placeholder/off-net/serviceQualificationManagement/v4/ServiceSpecification/1',
          name: 'Off_Net_Unmanaged',
          version: '1.0',
          '@type': 'ServiceSpecification',
        },
      },
    },
  ],
};
// 2377068  no footprint
describe('Pass if time of request, response is recorded to History Log table )', () => {
  test('Qual Api will return a good response for a instantSyncQualification True Case', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
      request
    );

    expect(response.status).toBe(200);


  },30000);


});
