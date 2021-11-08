/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

describe('Get By Id QSQ test', () => {
  test('Should GET good response from Firestore using request Id validate serviceSpecification name and number of itmes', async () => {
    const response = await axios.get(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification/zN9Ct7pxiByk9hCKKZHv`
    );

    expect(response.status).toBe(200);

    expect(response.data).toEqual(
      expect.objectContaining({ id: 'zN9Ct7pxiByk9hCKKZHv' })
    );

    expect(
      response.data.serviceQualificationItem[0].serviceSpecification
    ).toEqual(expect.objectContaining({ name: 'Office National Internet' }));
    expect(
      response.data.serviceQualificationItem[1].serviceSpecification
    ).toEqual(
      expect.objectContaining({ name: 'Office National Internet Enhanced' })
    );
    expect(
      response.data.serviceQualificationItem[2].serviceSpecification
    ).toEqual(
      expect.objectContaining({ name: 'Office National Internet Enhanced' })
    );
    expect(
      response.data.serviceQualificationItem[3].serviceSpecification
    ).toEqual(
      expect.objectContaining({ name: 'Office National Internet Professional' })
    );
    expect(
      response.data.serviceQualificationItem[4].serviceSpecification
    ).toEqual(
      expect.objectContaining({ name: 'Office National Internet Extra' })
    );
    expect(
      response.data.serviceQualificationItem[5].serviceSpecification
    ).toEqual(
      expect.objectContaining({ name: 'Office National Internet Extra' })
    );
    expect(
      response.data.serviceQualificationItem[6].serviceSpecification
    ).toEqual(
      expect.objectContaining({ name: 'Office National Internet Advanced' })
    );
    expect(
      response.data.serviceQualificationItem[7].serviceSpecification
    ).toEqual(
      expect.objectContaining({ name: 'Office National Internet Premium' })
    );

    expect(response.data).not.toEqual(
      expect.objectContaining({ id: `zN9Ct7pxiByk9hCKKZHv111111111` })
    );

    expect(
      response.data.serviceQualificationItem[0].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({ name: 'ZZOffice National InternetZZZ' })
    );
    expect(
      response.data.serviceQualificationItem[1].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({ name: 'ZZOffice National Internet EnhancedZZ' })
    );
    expect(
      response.data.serviceQualificationItem[2].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({ name: 'ZZOffice National Internet EnhancedZZ' })
    );
    expect(
      response.data.serviceQualificationItem[3].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({
        name: 'XXOffice National Internet Professional',
      })
    );
    expect(
      response.data.serviceQualificationItem[4].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({ name: 'XXOffice National Internet Extra' })
    );
    expect(
      response.data.serviceQualificationItem[5].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({ name: 'XXOffice National Internet Extra' })
    );
    expect(
      response.data.serviceQualificationItem[6].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({ name: 'XXOffice National Internet Advanced' })
    );
    expect(
      response.data.serviceQualificationItem[7].serviceSpecification
    ).not.toEqual(
      expect.objectContaining({ name: 'XXOffice National Internet Premium' })
    );
  });
});
