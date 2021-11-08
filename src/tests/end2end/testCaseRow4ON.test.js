/* eslint-disable no-underscore-dangle */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

describe('QSQ POST test Province of ON', () => {
  test('Should Find offer from province and return a Partner Offers', async () => {
    const request = {
      description: 'Initial Technical 111111',
      externalId: '6161:SQ101',
      '@type': 'QueryServiceQualification',
      searchCriteria: {
        '@type': 'ServiceQualificationItem',
        service: {
          serviceType: 'business',
          '@type': 'Service',
          place: [
            {
              id: '34451',
              role: 'Service Qualification Place',
              '@type': 'GeographicAddress',
            },
          ],
        },
      },
    };

    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification`,
      request
    );

    expect(response.status).toBe(200);

    expect(
      response.data.serviceQualificationItem[0].serviceSpecification.name
    ).toMatch('Office National Internet Basic');
    expect(
      response.data.serviceQualificationItem[1].serviceSpecification.name
    ).toMatch('Office National Internet Basic');
    expect(
      response.data.serviceQualificationItem[2].serviceSpecification.name
    ).toMatch('Office National Internet Basic');

    expect(
      response.data.serviceQualificationItem[3].serviceSpecification.name
    ).toMatch('Office National Internet');
    expect(
      response.data.serviceQualificationItem[4].serviceSpecification.name
    ).toMatch('Office National Internet');

    expect(
      response.data.serviceQualificationItem[5].serviceSpecification.name
    ).toMatch('Office National Internet Plus');

    expect(
      response.data.serviceQualificationItem[6].serviceSpecification.name
    ).toMatch('Office National Internet Enhanced');
    expect(
      response.data.serviceQualificationItem[7].serviceSpecification.name
    ).toMatch('Office National Internet Enhanced');

    expect(
      response.data.serviceQualificationItem[8].serviceSpecification.name
    ).toMatch('Office National Internet Professional');
    expect(
      response.data.serviceQualificationItem[9].serviceSpecification.name
    ).toMatch('Office National Internet Professional');
    expect(
      response.data.serviceQualificationItem[10].serviceSpecification.name
    ).toMatch('Office National Internet Professional');

    expect(
      response.data.serviceQualificationItem[11].serviceSpecification.name
    ).toMatch('Office National Internet Complete');
    expect(
      response.data.serviceQualificationItem[12].serviceSpecification.name
    ).toMatch('Office National Internet Complete');

    expect(
      response.data.serviceQualificationItem[13].serviceSpecification.name
    ).toMatch('Office National Internet Extra');
    expect(
      response.data.serviceQualificationItem[14].serviceSpecification.name
    ).toMatch('Office National Internet Extra');
    expect(
      response.data.serviceQualificationItem[15].serviceSpecification.name
    ).toMatch('Office National Internet Extra');
    expect(
      response.data.serviceQualificationItem[16].serviceSpecification.name
    ).toMatch('Office National Internet Extra');

    expect(
      response.data.serviceQualificationItem[17].serviceSpecification.name
    ).toMatch('Office National Internet Advanced');
    expect(
      response.data.serviceQualificationItem[18].serviceSpecification.name
    ).toMatch('Office National Internet Advanced');
    expect(
      response.data.serviceQualificationItem[19].serviceSpecification.name
    ).toMatch('Office National Internet Advanced');

    expect(
      response.data.serviceQualificationItem[20].serviceSpecification.name
    ).toMatch('Office National Internet Premium');
    expect(
      response.data.serviceQualificationItem[21].serviceSpecification.name
    ).toMatch('Office National Internet Premium');

    expect(
      response.data.serviceQualificationItem[20].serviceSpecification.name
    ).not.toMatch('Office National Internet Advanced');
    expect(
      response.data.serviceQualificationItem[14].serviceSpecification.name
    ).not.toMatch('Office National Internet Premium');
    expect(
      response.data.serviceQualificationItem[9].serviceSpecification.name
    ).not.toMatch('Office National Internet Premium');
  });
});
