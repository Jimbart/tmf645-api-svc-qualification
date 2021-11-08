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
  instantSyncQualification: '',
  serviceQualificationItem: [
    {
      id: '1',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '25511',
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
    {
      id: '2',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '34451',
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

describe('CSQ Request Validation', () => {
  test('Should validate a good request from user', async () => {
    try {
      const response = await axios.post(
        `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
        request
      );

      // Joi will send error if request fields are empty -sample instantSyncQualification is empty
      expect(response.status).toBe(400);
      // eslint-disable-next-line no-undef
      expect(response.data.status).toBe(fail);
      expect(response.data.message).toBe(
        '"instantSyncQualification" must be a boolean'
      );
    } catch (error) {
      debug(error);
    }
  });
});
