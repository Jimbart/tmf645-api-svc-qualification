/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

describe('Get By Id CSQ test', () => {
  test('Should GET a good response from Firestore using request id and validate returned fields', async () => {
    const response = await axios.get(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification/2mkbuaBHtD6E9dBoEFPO`
    );

    expect(response.status).toBe(200);

    expect(response.data).toEqual(
      expect.objectContaining({
        id: '2mkbuaBHtD6E9dBoEFPO',
        state: 'done',
        externalId: '6161:SQ101',
      })
    );

    expect(response.data.serviceQualificationItem[0].service.place[0]).toEqual(
      expect.objectContaining({
        id: '25511',
        streetNr: '19',
        streetType: 'STREET',
        city: 'Toronto',
        stateOrProvince: 'ON',
        postcode: 'M5E1Z9',
      })
    );
    expect(
      response.data.serviceQualificationItem[0].service.relatedParty
    ).toEqual(expect.objectContaining({ name: 'COGECO_ON' }));
    expect(
      response.data.serviceQualificationItem[0].service.serviceCharacteristic[0]
        .value
    ).toEqual(expect.objectContaining({ speed: 'Not_Found' }));

    expect(response.data.serviceQualificationItem[1].service.place[0]).toEqual(
      expect.objectContaining({
        id: '34451',
        streetNr: '19',
        streetType: 'STREET',
        city: 'Toronto',
        stateOrProvince: 'ON',
        postcode: 'M5E1Z9xx',
      })
    );
    expect(
      response.data.serviceQualificationItem[1].service.relatedParty
    ).toEqual(expect.objectContaining({ name: 'COGECO_QC' }));
    expect(
      response.data.serviceQualificationItem[1].service.serviceCharacteristic[0]
        .value
    ).toEqual(
      expect.objectContaining({
        speed: 'Not_Found',
        technology: 'Not_Found',
      })
    );

    expect(
      response.data.serviceQualificationItem[0].service.relatedParty
    ).not.toEqual(expect.objectContaining({ name: 'Kenny Rogers' }));
    expect(
      response.data.serviceQualificationItem[0].service.serviceCharacteristic[0]
        .value
    ).not.toEqual(
      expect.objectContaining({ speed: '50 mile p/h / 100 miles p/h' })
    );
  });
});
