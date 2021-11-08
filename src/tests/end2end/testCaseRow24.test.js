import axios from 'axios';
import createDebug from 'debug';
import path from 'path';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

const debug = createDebug(path.basename(__filename, '.js'));

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
            id: '00001',
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
    }
  ],
};

describe('CSQ Error Response for Email', () => {
  test('CSQ Should return QualificationItem is empty of null', async () => {
    //try {
      const response = await axios.post(
        `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
        request
      );

      // responsr status 200
      expect(response.status).toBe(200);

      // will be replace by TWError
      expect(response.data.state).toBe('done');

      // vaidate that the serviceQualificationItem is null and empty
      expect(JSON.stringify(response.data.serviceQualificationItem)).toBe('[]')


      
    
    // } catch (error) {
    //   debug(error);
    // }
  });
});
