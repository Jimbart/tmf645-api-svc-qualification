/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import endToEndSetup from './setup/endToEnd.setup';
import config from '../../config';

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
            id: '1234567',
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

describe('Test BELL case for ANY PROVINCE (Expired and NO Footprint)', () => {
  test('Qual Api will return all expected offers as fetch in API', async () => {
    // demo lpds id  1234567 ON
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
      request
    );

    expect(response.status).toBe(200);

    expect(response.data).toEqual(
      expect.objectContaining({
        state: 'done',
        externalId: '6161:SQ101',
      })
    );

    // validate response qualificationResult
    expect(
      response.data.serviceQualificationItem[0].qualificationResult
    ).toEqual('qualified');

    // validate response related party
    expect(
      response.data.serviceQualificationItem[0].service.relatedParty
    ).toEqual(
      expect.objectContaining({
        name: 'Bell',
        role: 'Partner',
      })
    );

    // validate response serviceCharacteristic value
    expect(
      response.data.serviceQualificationItem[0].service.serviceCharacteristic[0]
        .value
    ).toEqual(
      expect.objectContaining({
        speed: '50mbps/100mbps',
        technology: 'unknown',
      })
    );

    // response assertion
    expect(response.data).not.toEqual(
      expect.objectContaining({
        state: 'inProgress',
        externalId: '6161:SQ101zzzzzzzz',
      })
    );
  });
});
