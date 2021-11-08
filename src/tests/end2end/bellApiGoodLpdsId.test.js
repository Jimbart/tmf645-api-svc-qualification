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
            id: '21254495',
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
// 21254496 dummy lpdsId
describe('Bell Api Service Qualification( NF LpdsId )', () => {
  test('Qual Api will return a good response for LpdsId Found in AMS in Province of ON', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
      request
    );

    expect(response.status).toBe(200);

    // validate response header
    expect(response.data).toEqual(
      expect.objectContaining({
        state: 'done',
      })
    );

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
        .name
    ).toEqual('Bell Wholesale Business Internet 20x4');

    // response assertion

    expect(
      response.data.serviceQualificationItem[0].service.place[0]
    ).not.toEqual(
      expect.objectContaining({
        schoolid: '12345678',
        county: 'California ',
        zip: 'CA90210',
      })
    );
  }, 30000);
});
