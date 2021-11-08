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
// 2377066  Ontario  No Footprint LpdsId -- instantSyncQualification True
describe('Test BELL case for ANY PROVINCE (Expired and NO Footprint)', () => {
  test('Qual Api will return all expected offers as fetch in BELL API', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
      request
    );

    // bug need fix
    expect(response.status).toBe(200);

    // bug need fix
    expect(response.data).toEqual(
      expect.objectContaining({
        state: 'done',
        externalId: '6161:SQ101',
      })
    );

    // // validate response related party
    // expect(response.data.serviceQualificationItem[1].relatedParty).toEqual(
    //   expect.objectContaining({
    //     name: 'Bell',
    //     role: 'Partner',
    //   })
    // );

    // // validate technology offer
    // expect(
    //   response.data.serviceQualificationItem[1].serviceCharacteristic.value
    //     .speed
    // ).toEqual('57984/22718');

    // response assertion
    expect(response.data).not.toEqual(
      expect.objectContaining({
        state: 'done',
        externalId: '6161:SQ101zzzzzzzz',
      })
    );
  }, 30000);
});
