/* eslint-disable no-underscore-dangle */
import csq from '../../controllers/CheckServiceQualificationController';
import amsApi from '../../vendor_api/AmsApi';

test('build request object from for external api calls ( shaw and bell )', async () => {
  const amsAddress = await amsApi.getAddressByLpdsId('2377066');
  const request = csq._buildExternalApiRequestObject(amsAddress);

  expect(request.GEO_CITY).toBe('BURLINGTON');
  expect(request.GEO_PROVINCE).toBe('ON');
  expect(request.GEO_COUNTRY).toBe('CAN');
  expect(request.GEO_POSTAL).toBe('L7R3J7');
});
