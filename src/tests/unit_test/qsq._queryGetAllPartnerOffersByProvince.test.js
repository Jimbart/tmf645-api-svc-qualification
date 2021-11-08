/* eslint-disable no-underscore-dangle */
import GetAllPartnerOffersByProvince from '../../controllers/QueryServiceQualificationController';

describe('_queryGetAllPartnerOffersByProvince method test', () => {
  test.skip('Result should match to province query to the method', async () => {
    const resultAB = await GetAllPartnerOffersByProvince._queryGetAllPartnerOffersByProvince(
      'AB'
    );
    const parsedResultAB = JSON.parse(resultAB);
    const partnerOfferAB = parsedResultAB.map((row) => row.PROVINCE_ABBREV);
    const filteredPartner = partnerOfferAB.filter(
      (item, i, ar) => ar.indexOf(item) === i
    );
    expect(filteredPartner.toString()).toBe('AB');
    // assert
    // expect(filteredPartner.toString()).toBe('BC')
  });
});
