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
            id: '34456',
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

// 25511  ON    34456   ON
describe('CSQ response validation', () => {
  test('Validate response match to requirements', async () => {
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

    // validate response related party for lpdsId 25511
    expect(
      response.data.serviceQualificationItem[0].service.relatedParty
    ).toEqual(
      expect.objectContaining({
        name: 'COGECO_ON',
        role: 'Partner',
      })
    );

    // validate response related party  for lpdsId 34456
    expect(
      response.data.serviceQualificationItem[1].service.relatedParty
    ).toEqual(
      expect.objectContaining({
        name: 'ShAw',
        role: 'Vendor',
      })
    );

    // validate response serviceCharacteristic value for lpdsId 25511
    expect(
      response.data.serviceQualificationItem[0].service.serviceCharacteristic[0]
        .value
    ).toEqual(
      expect.objectContaining({
        speed: 'Not_Found',
        technology: 'Not_Found',
      })
    );

    // validate response serviceCharacteristic value for lpdsId 34456
    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[0]
        .value
    ).toEqual(
      expect.objectContaining({
        speed: '20/4 Mbps',
        technology: '5G outer space',
      })
    );

    // validate response place
    expect(response.data.serviceQualificationItem[0].service.place[0]).toEqual(
      expect.objectContaining({
        id: '25511',
        city: 'Toronto',
        postcode: 'M5E1Z9',
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
