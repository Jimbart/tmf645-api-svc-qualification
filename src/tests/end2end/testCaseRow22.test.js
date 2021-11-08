/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import endToEndSetup from './setup/endToEnd.setup';
import config from '../../config';

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
    {
      id: '3',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '3059020',
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

describe('Multiple Vendor Test(Good Lpds,No Foot Print and Expire))', () => {
  test('Qual Api perform multiple task like call Api,send email and return a good response', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
      request
    );

    expect(response.status).toBe(201);

    expect(response.data).toEqual(
      expect.objectContaining({
        state: 'inProgress',
        externalId: '6161:SQ101',
      })
    );

    // validate response qualificationResult
    expect(
      response.data.serviceQualificationItem[0].qualificationResult
    ).toEqual('unqualified');

    // response assertion

    expect(response.data).not.toEqual(
      expect.objectContaining({
        state: 'done',
        externalId: '6161:SQ101zzzzzzzz',
      })
    );
  },30000);
});
