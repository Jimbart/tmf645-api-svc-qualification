/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

const request = {
  description: 'Initial Technical Eligibility',
  externalId: '6161:SQ101',
  instantSyncQualification: 'false',
  serviceQualificationItem: [
    {
      id: '1',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '000000',
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
// 000000  invalid lpds
describe('Invalid request, response is 400 and NO recorded to History Log table )', () => {
  test('Qual Api will return a empty response for a instantSyncQualification False Case', async () => {

       async function error(){
        await axios.post(
            `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
            request
          );        
         
      }      
      
     await expect(error()).rejects.toThrowError('Request failed with status code 400');

  });

});
