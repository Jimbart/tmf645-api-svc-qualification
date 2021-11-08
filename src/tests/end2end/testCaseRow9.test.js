/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import endToEndSetup from './setup/endToEnd.setup';
import config from '../../config';

endToEndSetup.initServer();

const request = {
  description: 'Initial Technical Eligibility',
  externalId: '6161:SQ101',
  instantSyncQualification: 'True',
  serviceQualificationItem: [
    {
      id: '1',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '2377066',
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
// 2377066 Expire Shaw lpdsId --  instantSyncQualification True
describe('Test SHAW case for NON-AB/BC (Expire/No FootPrint)', () => {
  test('Qual Api will call Shaw Api and fetch service technology and return a good response', async () => {
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

    // validate response
    expect(response.data.serviceQualificationItem[0].relatedParty.name).toEqual(
      'Shaw'
    );

    // validate technology
    expect(
      response.data.serviceQualificationItem[0].serviceCharacteristic.value
        .speed
    ).toEqual('unknown');
    // expect(
    //   response.data.serviceQualificationItem[1].serviceCharacteristic.value
    //     .speed
    // ).toEqual('57984/22718');

    // response assertion
    expect(response.data).not.toEqual(
      expect.objectContaining({
        state: 'inProgress',
        externalId: '6161:SQ101zzzzzzzz',
      })
    );
  }, 30000);
});
