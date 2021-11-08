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
            id: '23639008',
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
// 23639008
describe('Videotron Service Qualification( No FootPrint LpdsId )', () => {
  test('Qual Api will return a good response for LpdsId Found in AMS in Province of ON,QC', async () => {
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
      response.data.serviceQualificationItem[1].service.relatedParty
    ).toEqual(
      expect.objectContaining({
        name: 'Fibrenoire/Videotron',
        role: 'Partner',
      })
    );

    // validate response serviceCharacteristic value
    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[0]
        .name
    ).toEqual('Videotron Internet Fibre Hybrid 8');

    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[0]
        .value
    ).toEqual({ speed: '8/1 Mbps', technology: 'Coax' });
    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[1]
        .name
    ).toEqual('Videotron Internet Fibre Hybrid 15');

    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[2]
        .name
    ).toEqual('Videotron Internet Fibre Hybrid 100');

    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[3]
        .name
    ).toEqual('Videotron Internet Fibre Hybrid 200');

    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[4]
        .name
    ).toEqual('Videotron Internet Fibre Hybrid 400');

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
  }, 30000);
});
