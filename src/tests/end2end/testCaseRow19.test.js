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
            id: '33789',
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
// 33789
describe('CSQ COGECO Email Case( Good FootPrint in FS )', () => {
  test('Qual Api will return a good response match to request', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
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

    // validate response related party
    expect(
      response.data.serviceQualificationItem[0].service.relatedParty
    ).toEqual(
      expect.objectContaining({
        name: 'Cogeco',
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

    // validate response place
    expect(response.data.serviceQualificationItem[0].service.place[0]).toEqual(
      expect.objectContaining({
        id: '33789',
        city: 'Cogeco',
        postcode: 'C12345',
      })
    );

    // response assertion

    expect(
      response.data.serviceQualificationItem[0].service.place[0]
    ).not.toEqual(
      expect.objectContaining({
        schoolid: '25511xxx',
        county: 'Torontoxxx ',
        zip: 'M5E1Z9xx',
      })
    );
  });
});
